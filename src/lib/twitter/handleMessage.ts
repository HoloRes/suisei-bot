import { Listener } from '@sapphire/framework';
import { ChannelType, Message } from 'discord.js';
import { HttpUrlRegex } from '@sapphire/discord.js-utilities';
import axios from 'axios';
import { Time } from '@sapphire/time-utilities';

const ACCEPTED_HOSTS = [
	'twitter.com',
	'fxtwitter.com',
	'twittpr.com',
	'x.com',
	'fixupx.com',
	'vxtwitter.com',
];

const TWEET_LINK_REGEX = /^\/(\w|\d)+\/status\/(?<id>\d{18,})(\/.+)?/;

// This only contains the important properties
interface VxTwitterResponse {
	date_epoch: number;
	user_screen_name: string;
}

export default async function handleMessage(this: Listener, message: Message) {
	if (message.author.id === this.container.client.id) return;
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
		if (HttpUrlRegex.test(str)) potentialUrls.push(str);
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

		// Valid Twitter URl! Check if it looks like a Tweet link
		if (!TWEET_LINK_REGEX.test(url.pathname)) return;

		// Seems like a valid Tweet link, grab the id
		const exec = TWEET_LINK_REGEX.exec(url.pathname)!;
		const { id } = exec.groups!;

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
			await this.container.meiliClient.index('twitter-users').getDocument(res.data.user_screen_name);
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
				handle: res.data.user_screen_name,
			},
		});

		const notifyTasks = subscribers.map(async (sub) => {
			const notifChannel = await this.container.client.channels.fetch(sub.channelId)
				.catch((err) => {
					this.container.logger.error(err);
				});

			// Channel is missing or broken, ignore for now. Should delete the row at some point
			if (!notifChannel) return;

			if (notifChannel.type !== ChannelType.GuildAnnouncement
				&& notifChannel.type !== ChannelType.GuildText) return;

			await notifChannel.send(`${sub.message ? `${sub.message}\n\n` : ''}https://fxtwitter.com/${sub.handle}/status/${id}`);
		});

		await Promise.all(notifyTasks);
	});

	await Promise.all(tasks);
}
