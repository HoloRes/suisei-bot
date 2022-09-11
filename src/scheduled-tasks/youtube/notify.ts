import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { Video, VideoWithChannel } from '@holores/holodex/dist/types';
import { MessageEmbed } from 'discord.js';
import formatStringTemplate from 'string-template';

export class YoutubeNotifyTask extends ScheduledTask {
	public constructor(context: ScheduledTask.Context, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'youtubeNotify',
			cron: '*/5 * * * *',
		});
	}

	private async notify(stream: VideoWithChannel) {
		// Check if the stream already exists in the db
		const dbStream = await this.container.db.livestream.findUnique({
			where: {
				id: stream.id,
			},
		});

		// Pre-emptively return if there's nothing to update
		if (dbStream) {
			this.container.counters.youtube.success.inc(1);
			return;
		}

		// Fetch the Youtube channel from the db
		const channel = await this.container.db.youtubeChannel.findUnique({
			where: {
				id: stream.channel.id,
			},
		});
		if (!channel) {
			this.container.counters.youtube.success.inc(1);
			return;
		}

		// Fetch all subscriptions for this channel
		const subscriptions = await this.container.db.subscription.findMany({
			where: {
				channelId: stream.channel.id,
			},
			select: {
				id: true,
				message: true,
			},
		});

		// Create the embed for the livestream
		const embed = new MessageEmbed()
			.setTitle(stream.title)
			.setURL(`https://youtu.be/${stream.id}`)
			.setImage(`https://i.ytimg.com/vi/${stream.id}/maxresdefault.jpg`)
			.setColor('#FF0000')
			.setFooter({ text: 'Powered by Suisei\'s mic' });

		const messageIds: string[] = [];

		const notifMessages = subscriptions.map(async (sub) => {
			const notifChannel = await this.container.client.channels.fetch(sub.id)
				.catch((err) => {
					this.container.logger.error(err);
				});

			// Channel is missing or broken, ignore for now. Should delete the row at some point
			if (!notifChannel) return;

			if (notifChannel.type !== 'GUILD_TEXT' && notifChannel.type !== 'GUILD_NEWS') return;

			const webhooks = await notifChannel.fetchWebhooks();
			let webhook = webhooks.find((wh) => wh.name.toLowerCase() === 'stream notification');

			if (!webhook) {
				const newWebhook = await notifChannel.createWebhook('Stream notification')
					.catch((err) => {
						this.container.logger.error(err);
					});

				if (!newWebhook) return;
				webhook = newWebhook;
			}

			const msg = await webhook.send({
				content: sub.message,
				embeds: [embed],
				username: channel.englishName || channel.name,
				avatarURL: channel.photo ?? undefined,
			});

			messageIds.push(msg.id);
		});

		const queryChannels = await this.container.db.querySubscription.findMany({
			where: {
				NOT: {
					OR: [
						{
							excludedVtubers: {
								has: stream.channel.id,
							},
						},
						{
							excludedOrgs: {
								has: channel.org!.toLowerCase(),
							},
						},
						{
							excludedSubOrgs: channel.subOrg ? {
								has: channel.subOrg.toLowerCase(),
							} : undefined,
						},
					],
				},
				AND: {
					includedVtubers: {
						hasSome: [stream.channel.id, '*'],
					},
					includedOrgs: {
						hasSome: [channel.org!.toLowerCase(), '*'],
					},
					includedSubOrgs: {
						hasSome: channel.subOrg ? [channel.subOrg.toLowerCase(), '*'] : ['*'],
					},
				},
			},
		});

		const queryNotifMessages = queryChannels.map(async (sub) => {
			const notifChannel = await this.container.client.channels.fetch(sub.id)
				.catch((err) => {
					this.container.logger.error(err);
				});

			// Channel is missing or broken, ignore for now. Should delete the row at some point
			if (!notifChannel) return;

			if (notifChannel.type !== 'GUILD_TEXT' && notifChannel.type !== 'GUILD_NEWS') return;

			const webhooks = await notifChannel.fetchWebhooks();
			let webhook = webhooks.find((wh) => wh.name.toLowerCase() === 'stream notification');

			if (!webhook) {
				const newWebhook = await notifChannel.createWebhook('Stream notification')
					.catch((err) => {
						this.container.logger.error(err);
					});

				if (!newWebhook) return;
				webhook = newWebhook;
			}

			const message = formatStringTemplate(sub.message, {
				name: channel.englishName || channel.name,
				org: channel.org,
				subOrg: channel.subOrg,
			});

			const msg = await webhook.send({
				content: message,
				embeds: [embed],
				username: channel.englishName || channel.name,
				avatarURL: channel.photo ?? undefined,
			});

			messageIds.push(msg.id);
		});

		await Promise.all([...notifMessages, ...queryNotifMessages]);

		await this.container.db.livestream.create({
			data: {
				id: stream.id,
				title: stream.title,
				messageIds,
			},
		});
		this.container.counters.youtube.success.inc(1);
	}

	private async removeStream(stream: Video) {
		// TODO: Likely requires some db changes and having to save the webhook url/creds
		/* // Check if the stream exists in the db
		const dbStream = await this.container.db.livestream.findUnique({
			where: {
				id: stream.id,
			},
		});

		if(!dbStream) return;

		const tasks = dbStream.messageIds.map((id) => {

		}) */

		try {
			await this.container.db.livestream.delete({
				where: {
					id: stream.id,
				},
			});
			// eslint-disable-next-line no-empty
		} catch {}
	}

	public async run() {
		this.container.logger.debug('Pushing notifications');
		let count = 0;
		const tasks: Promise<void>[] = [];

		const firstStreamsPage = await this.container.holodexClient.videos.getLivePaginated({
			status: 'live',
			type: 'stream',
			sort: 'available_at',
			order: 'asc',
			maxUpcomingHours: 1,
		});
		count += firstStreamsPage.total;

		firstStreamsPage.items.forEach((stream) => {
			tasks.push(this.notify(stream as VideoWithChannel));
		});

		const fetchNextStreams = async (page: number) => {
			const currentPage = await this.container.holodexClient.videos.getLivePaginated({
				status: 'live',
				type: 'stream',
				sort: 'available_at',
				order: 'asc',
				maxUpcomingHours: 1,
				offset: page * 9999,
			});
			count += currentPage.total;

			currentPage.items.forEach((stream) => {
				tasks.push(this.notify(stream as VideoWithChannel));
			});
		};

		for (let i = 1; i * 9999 < firstStreamsPage.total; i++) {
			// Await to ease load on the API
			// eslint-disable-next-line no-await-in-loop
			await fetchNextStreams(i);
		}

		// Increase Prometheus counter
		this.container.counters.youtube.total.inc(count);

		const firstPastPage = await this.container.holodexClient.videos.getVideosPaginated({
			status: 'past',
			type: 'stream',
			sort: 'end_actual',
			order: 'desc',
			from: new Date(Date.now() - (3600 * 1000)),
			to: new Date(),
			limit: 50,
		});

		firstPastPage.items.forEach((stream) => {
			tasks.push(this.removeStream(stream));
		});

		const fetchNextPastStreams = async (page: number) => {
			const currentPage = await this.container.holodexClient.videos.getVideosPaginated({
				status: 'past',
				type: 'stream',
				sort: 'end_actual',
				order: 'desc',
				from: new Date(Date.now() - (3600 * 1000)),
				to: new Date(),
				limit: 50,
				offset: page * 50,
			});

			currentPage.items.forEach((stream) => {
				tasks.push(this.removeStream(stream));
			});
		};

		for (let i = 1; i * 50 < firstPastPage.total; i++) {
			// Await to ease load on the API
			// eslint-disable-next-line no-await-in-loop
			await fetchNextPastStreams(i);
		}

		await Promise.all(tasks);
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		cron: never;
		manual: never;
	}
}
