import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { ChannelType, EmbedBuilder } from 'discord.js';
import searchQuery from 'search-query-parser';

interface VTuber {
	id: string;
	name: string;
	englishName?: string;
	org?: string;
	subOrg?: string;
}

@ApplyOptions<Subcommand.Options>({
	name: 'subscriptions',
	description: 'Manage YouTube notification subscriptions',
	subcommands: [
		{
			name: 'add',
			chatInputRun: 'chatInputAdd',
		},
		{
			name: 'setquery',
			chatInputRun: 'chatInputSetQuery',
		},
		{
			name: 'remove',
			chatInputRun: 'chatInputRemove',
		},
		{
			name: 'list',
			chatInputRun: 'chatInputList',
		},
	],
	preconditions: ['StaffOnly'],
})
export class SubscriptionCommand extends Subcommand {
	public async chatInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {
		const channelId = interaction.options.getString('vtuber', true);
		const notifChannel = interaction.options.getChannel('channel', true, [ChannelType.GuildAnnouncement, ChannelType.GuildText]);
		const message = interaction.options.getString('message', true);

		await interaction.deferReply();

		// Find the VTuber in the db
		const channel = await this.container.db.youtubeChannel.findUnique({
			where: {
				id: channelId,
			},
			include: {
				subscriptions: {
					select: {
						id: true,
					},
				},
			},
		});

		if (channel) {
			// Check if the channel is already subscribed
			if (channel.subscriptions.findIndex((sub) => sub.id === notifChannel.id) !== -1) {
				await interaction.editReply(`<#${notifChannel.id}> was already subscribed to ${channel.englishName || channel.name}`);
				return;
			}

			// No, so add the channel id
			await this.container.db.subscription.create({
				data: {
					id: notifChannel.id,
					channelId: channel.id,
					message,
				},
			});

			const webhooks = await notifChannel.fetchWebhooks();

			const webhook = await webhooks.find((wh) => wh.name.toLowerCase() === 'stream notification');

			if (!webhook) {
				await notifChannel.createWebhook({
					name: 'Stream notification',
				});
			}

			// eslint-disable-next-line eqeqeq
			await interaction.editReply(`<#${notifChannel.id}> is now subscribed to ${channel.englishName || channel.name}`);
			return;
		}

		// The channel didn't exist, so search in the Holodex API
		const vtuber = await this.container.holodexClient.channels.getInfo(channelId)
			.catch(() => {
				interaction.editReply('Failed to fetch VTuber');
			});
		if (!vtuber) return;

		if (vtuber.type !== 'vtuber') {
			await interaction.editReply('Channel is not a VTuber!');
			return;
		}

		// Row doesn't exist, create one
		await this.container.db.youtubeChannel.create({
			data: {
				id: channelId,
				name: vtuber.name,
				englishName: vtuber.englishName,
				photo: vtuber.photo,
				org: vtuber.org,
				subOrg: vtuber.subOrg,
			},
		});

		await interaction.editReply(`<#${notifChannel.id}> is now subscribed to ${vtuber.englishName || vtuber.name}`);
	}

	public async chatInputSetQuery(interaction: Subcommand.ChatInputCommandInteraction) {
		const query = interaction.options.getString('query', true);
		const notifChannel = interaction.options.getChannel('channel', true, [ChannelType.GuildAnnouncement, ChannelType.GuildText]);
		const message = interaction.options.getString('message', true);

		await interaction.deferReply();

		interface ISearchParserResult extends searchQuery.SearchParserResult {
			text: string[];
			org?: string | string[];
			subOrg?: string | string[];
			vtuber?: string | string[];
			exclude: {
				org?: string | string[];
				subOrg?: string | string[];
				vtuber?: string | string[];
			}
		}

		const parsedQuery = searchQuery.parse(query, {
			keywords: ['org', 'subOrg', 'vtuber'],
			tokenize: true,
		}) as ISearchParserResult;

		/* eslint-disable no-nested-ternary */
		let includedVtubers: (string | undefined)[] = !parsedQuery.vtuber ? ['*'] : typeof parsedQuery.vtuber === 'string' ? [parsedQuery.vtuber] : parsedQuery.vtuber;
		const rawExcludedVtubers = !parsedQuery.exclude.vtuber ? [] : typeof parsedQuery.exclude.vtuber === 'string' ? [parsedQuery.exclude.vtuber] : parsedQuery.exclude.vtuber;

		if (parsedQuery.vtuber) {
			includedVtubers = await Promise.all(includedVtubers.map(async (channel) => {
				const vtuber = await this.container.db.youtubeChannel.findFirst({
					where: {
						OR: [
							{
								id: channel,
							},
							{
								name: channel,
							},
							{
								englishName: channel,
							},
						],
					},
					select: { id: true },
				});

				return vtuber?.id;
			}));
		}
		const excludedVtubers = await Promise.all(rawExcludedVtubers.map(async (channel) => {
			const vtuber = await this.container.db.youtubeChannel.findFirst({
				where: {
					OR: [
						{
							id: {
								equals: channel,
								mode: 'insensitive',
							},
						},
						{
							name: {
								equals: channel,
								mode: 'insensitive',
							},
						},
						{
							englishName: {
								equals: channel,
								mode: 'insensitive',
							},
						},
					],
				},
				select: { id: true },
			});

			return vtuber?.id;
		}));

		const data = {
			message,

			includedOrgs: (parsedQuery.org === undefined ? ['*'] : typeof parsedQuery.org === 'string' ? [parsedQuery.org] : parsedQuery.org).map((val) => val.toLowerCase()),
			includedSubOrgs: (parsedQuery.subOrg === undefined ? ['*'] : typeof parsedQuery.subOrg === 'string' ? [parsedQuery.subOrg] : parsedQuery.subOrg).map((val) => val.toLowerCase()),
			includedVtubers: includedVtubers.filter((ch) => !!ch) as string[],

			excludedOrgs: (parsedQuery.exclude.org === undefined ? [] : typeof parsedQuery.exclude.org === 'string' ? [parsedQuery.exclude.org] : parsedQuery.exclude.org).map((val) => val.toLowerCase()),
			excludedSubOrgs: (parsedQuery.exclude.subOrg === undefined ? [] : typeof parsedQuery.exclude.subOrg === 'string' ? [parsedQuery.exclude.subOrg] : parsedQuery.exclude.subOrg).map((val) => val.toLowerCase()),
			excludedVtubers: excludedVtubers.filter((ch) => !!ch) as string[],
		};
		/* eslint-enable */

		await this.container.db.querySubscription.upsert({
			where: {
				id: notifChannel.id,
			},
			update: data,
			create: {
				id: notifChannel.id,
				...data,
			},
		});

		const webhooks = await notifChannel.fetchWebhooks();

		const webhook = await webhooks.find((wh) => wh.name.toLowerCase() === 'stream notification');

		if (!webhook) {
			await notifChannel.createWebhook({
				name: 'Stream notification',
			});
		}

		await interaction.editReply(`Query subscription set for <#${notifChannel.id}>`);
	}

	public async chatInputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
		const channelId = interaction.options.getString('vtuber', true);
		const notifChannel = interaction.options.getChannel('channel', true, [ChannelType.GuildAnnouncement, ChannelType.GuildText]);

		await interaction.deferReply();

		// Find the subscription in the db
		const channel = await this.container.db.youtubeChannel.findUnique({
			where: {
				id: channelId,
			},
			include: {
				subscriptions: {
					select: {
						id: true,
					},
				},
			},
		});

		if (!channel) {
			await interaction.editReply(`<#${notifChannel.id}> is not subscribed to that channel`);
			return;
		}

		// Check if the channel is already subscribed
		if (channel.subscriptions.findIndex((sub) => sub.id === notifChannel.id) !== -1) {
			await this.container.db.subscription.delete({
				where: {
					id_channelId: {
						id: notifChannel.id,
						channelId: channel.id,
					},
				},
			});

			await interaction.editReply(`<#${notifChannel.id}> has unsubscribed from ${channel.englishName || channel.name}`);
			return;
		}

		await interaction.editReply(`<#${notifChannel.id}> is not subscribed to ${channel.englishName || channel.name}`);
	}

	public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
		const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildAnnouncement, ChannelType.GuildText]);
		await interaction.deferReply();

		const subscriptions = await this.container.db.subscription.findMany({
			where: {
				id: channel.id,
			},
			select: {
				message: true,
				channel: true,
			},
		});

		if (subscriptions.length === 0) {
			await interaction.editReply('This channel is not subscribed to any VTuber');
			return;
		}

		const display = new PaginatedMessage({
			template: new EmbedBuilder({
				description: `Subscriptions for: <#${channel.id}>`,
				footer: { text: 'Powered by Holodex.net' },
			}),
		});

		// eslint-disable-next-line no-restricted-syntax
		for (const subscription of subscriptions) {
			display.addPageEmbed((embed) => {
				if (subscription.channel.photo) {
					embed.setThumbnail(subscription.channel.photo);
				}

				return embed
					// eslint-disable-next-line max-len
					.setTitle(subscription.channel.englishName || subscription.channel.name)
					.setURL(`https://www.youtube.com/channel/${subscription.channel.id}`)
					.addFields([
						{
							name: 'Organization',
							value: `${subscription.channel.org} ${subscription.channel.subOrg ? `/ ${subscription.channel.subOrg.substring(2)}` : ''}`,
						},
						{
							name: 'Message',
							value: subscription.message,
						},
					]);
			});
		}

		await display.run(interaction);
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name !== 'vtuber') return;

		const searchResult = await this.container.meiliClient.index('vtubers').search<VTuber>(focusedOption.value, {
			limit: 25,
		});
		await interaction.respond(searchResult.hits.map((result) => ({
			name: `${result.englishName || result.name} (${result.org})`,
			value: result.id,
		})));
	}
}
