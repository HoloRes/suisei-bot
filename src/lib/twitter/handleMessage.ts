import { Listener } from '@sapphire/framework';
import { ChannelType, Message } from 'discord.js';
import axios from 'axios';
import { Time } from '@sapphire/time-utilities';
import RE2 from 're2';

const ACCEPTED_HOSTS = [
	'twitter.com',
	'fxtwitter.com',
	'c.fxtwitter.com',
	'twittpr.com',
	'x.com',
	'fixupx.com',
	'c.fixupx.com',
	'vxtwitter.com',
	'c.vxtwitter.com',
];

const LINK_REGEX = '(?<url>https?:\\/\\/[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*.com\\/(?:\\w|\\d)+\\/status\\/(?:\\d{18,}))';
const TWEET_PATH_REGEX = '^\\/(?:\\w|\\d)+\\/status\\/(?<id>\\d{18,})';

// This only contains the important properties
interface VxTwitterResponse {
	date_epoch: number;
	user_screen_name: string;
	media_extended: {
		type: 'image' | 'video';
		url: string;
	}[];
}

export default async function handleMessage(this: Listener, message: Message) {
	if (message.author.id === this.container.client.id) return;

	if (!message.content || !message.id) return;

	// Check if blacklisted
	const blacklist = await this.container.db.twitterBlacklist.findUnique({
		where: {
			id: message.author.id,
		},
	});

	if (blacklist) return;

	// Search for urls in the message
	const split = message.content.split(/\s/g);
	const potentialUrls: string[] = [];

	split.forEach((str) => {
		const res = new RE2(LINK_REGEX, 'gi').exec(str);
		if (res && res.groups) {
			potentialUrls.push(res.groups.url);
		}
	});

	const tasks = potentialUrls.map(async (linkStr) => {
		let url: URL;
		try {
			url = new URL(linkStr);
		} catch {
			// Invalid URL
			return;
		}

		if (!ACCEPTED_HOSTS.includes(url.hostname)) return;

		// Valid Twitter URl! Check if it looks like a Tweet link and grab the id
		const exec = new RE2(TWEET_PATH_REGEX).exec(url.pathname);
		if (!exec?.groups) return;
		const { id } = exec.groups;

		// Check if not already in database
		const share = await this.container.db.twitterShare.findUnique({
			where: {
				id,
			},
		});
		if (share) return;

		// Attempt to fetch the tweet
		let res;
		// Username doesn't matter at all, so hard code it
		try {
			res = await axios.get<VxTwitterResponse>(`https://api.vxtwitter.com/goldelysium/status/${id}`);
		} catch {
			// Likely invalid tweet
			return;
		}

		const postDate = new Date(0).setUTCSeconds(res.data.date_epoch);
		// Check if the post wasn't more than 6 hours ago
		if (Date.now() - postDate > Time.Hour * 6) return;

		try {
			await this.container.meiliClient.index('twitter-users').getDocument(res.data.user_screen_name.toLowerCase());
		} catch {
			// Not on the whitelist
			return;
		}

		try {
			await this.container.db.twitterShare.create({
				data: {
					id,
					date: new Date(postDate),
					sharedByUserId: message.author.id,
				},
			});
		} catch {
			// Race condition?
			return;
		}

		// This is completely valid! Send notifications and increase the user stats
		try {
			await this.container.db.twitterLeaderboardUser.upsert({
				where: {
					id: message.author.id,
				},
				create: {
					id: message.author.id,
					totalShares: 1,
					sharesThisMonth: 1,
				},
				update: {
					totalShares: {
						increment: 1,
					},
					sharesThisMonth: {
						increment: 1,
					},
				},
			});
		} catch {
			this.container.logger.error(`Failed to increase Twitter leaderboard stats for ${message.author.id}`);
		}

		const subscribers = await this.container.db.twitterSubscription.findMany({
			where: {
				handle: res.data.user_screen_name.toLowerCase(),
			},
		});

		let baseUrl = 'fxtwitter.com';

		const hasGifOrVideo = res.data.media_extended.map((media) => media.type === 'video' || new URL(media.url).pathname.endsWith('.gif')).includes(true);
		if (!hasGifOrVideo && res.data.media_extended.length > 1) {
			baseUrl = 'c.fxtwitter.com';
		}

		const notifyTasks = subscribers.map(async (sub) => {
			const notifChannel = await this.container.client.channels.fetch(sub.channelId)
				.catch((err) => {
					this.container.logger.error(err);
				});

			// Channel is missing or broken, ignore for now. Should delete the row at some point
			if (!notifChannel) return;

			if (notifChannel.type !== ChannelType.GuildAnnouncement
				&& notifChannel.type !== ChannelType.GuildText) return;

			await notifChannel.send(`${sub.message ? `${sub.message}\n\n` : ''}<https://twitter.com/${sub.handle}/status/${id}> ([fx](https://${baseUrl}/${sub.handle}/status/${id}))`);
		});

		await Promise.all(notifyTasks);
	});

	await Promise.all(tasks);
}
