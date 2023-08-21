import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
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
	description: 'Manage social media notification subscriptions',
	subcommands: [
		{
			name: 'youtube',
			type: 'group',
			entries: [
				{
					name: 'add',
					chatInputRun: 'chatInputYTUpsert',
				},
				{
					name: 'edit',
					chatInputRun: 'chatInputYTUpsert',
				},
				{
					name: 'setquery',
					chatInputRun: 'chatInputYTSetQuery',
				},
				{
					name: 'remove',
					chatInputRun: 'chatInputYTRemove',
				},
				{
					name: 'list',
					chatInputRun: 'chatInputYTList',
				},
			],
		},
		{
			name: 'twitter',
			type: 'group',
			entries: [
				{
					name: 'add',
					chatInputRun: 'chatInputTwitterUpsert',
				},
				{
					name: 'edit',
					chatInputRun: 'chatInputTwitterUpsert',
				},
				{
					name: 'remove',
					chatInputRun: 'chatInputTwitterRemove',
				},
				/* {
					name: 'list',
					chatInputRun: 'chatInputTwitterList',
				}, */
			],
		},
	],
})
export class SubscriptionCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
				.addSubcommandGroup((subcommandGroup) => subcommandGroup
					.setName('youtube')
					.setDescription('Manage YouTube subscriptions')
					.addSubcommand((command) => command
						.setName('add')
						.setDescription('Add a subscription')
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('vtuber')
							.setDescription('VTuber to send notifications for')
							.setAutocomplete(true))
						.addChannelOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('channel')
							.setDescription('Channel to send notifications in')
							.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText))
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('message')
							.setDescription('Message to include in the notification')))
					.addSubcommand((command) => command
						.setName('edit')
						.setDescription('Add a subscription')
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('vtuber')
							.setDescription('VTuber to send notifications for')
							.setAutocomplete(true))
						.addChannelOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('channel')
							.setDescription('Channel to send notifications in')
							.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText))
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('message')
							.setDescription('Message to include in the notification')))
					.addSubcommand((command) => command
						.setName('setquery')
						.setDescription('Set a query for notifications')
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('query')
							.setDescription('Query to filter for e.g. "org:hololive -org:nijisanji" (see docs)'))
						.addChannelOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('channel')
							.setDescription('Channel to send notifications in')
							.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText))
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('message')
							.setDescription('Message to include in the notification, can use parameters like {name} or {org} (see docs)')))
					.addSubcommand((command) => command
						.setName('remove')
						.setDescription('Remove a subscription')
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('vtuber')
							.setDescription('VTuber to send notifications for')
							.setAutocomplete(true))
						.addChannelOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('channel')
							.setDescription('Channel to send notifications in')
							.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)))
					.addSubcommand((command) => command
						.setName('list')
						.setDescription('List all subscriptions')
						.addChannelOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('channel')
							.setDescription('Channel to send notifications in')
							.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)))) //
				.addSubcommandGroup((subcommandGroup) => subcommandGroup
					.setName('twitter')
					.setDescription('Manage Twitter subscriptions')
					.addSubcommand((command) => command
						.setName('add')
						.setDescription('Add a subscription')
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('handle')
							.setDescription('Twitter handle to subscribe to')
							.setAutocomplete(true))
						.addChannelOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('channel')
							.setDescription('Channel to send notifications in')
							.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText))
						.addStringOption((optBuilder) => optBuilder
							.setName('message')
							.setDescription('Message to include in the notification')))
					.addSubcommand((command) => command
						.setName('edit')
						.setDescription('Add a subscription')
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('handle')
							.setDescription('Twitter handle to subscribe to')
							.setAutocomplete(true))
						.addChannelOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('channel')
							.setDescription('Channel to send notifications in')
							.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText))
						.addStringOption((optBuilder) => optBuilder
							.setName('message')
							.setDescription('Message to include in the notification')))
					.addSubcommand((command) => command
						.setName('remove')
						.setDescription('Add a subscription')
						.addStringOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('handle')
							.setDescription('Twitter handle to subscribe to')
							.setAutocomplete(true))
						.addChannelOption((optBuilder) => optBuilder
							.setRequired(true)
							.setName('channel')
							.setDescription('Channel to send notifications in')
							.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText))));
		});
	}

	// YouTube
	public async chatInputYTUpsert(interaction: Subcommand.ChatInputCommandInteraction) {
		const channelId = interaction.options.getString('vtuber', true);
		const notifChannel = interaction.options.getChannel('channel', true, [ChannelType.GuildAnnouncement, ChannelType.GuildText]);
		const message = interaction.options.getString('message', true);

		await interaction.deferReply();

		// Find the VTuber in the db
		let channel = await this.container.db.youtubeChannel.findUnique({
			where: {
				id: channelId,
			},
		});
		if (!channel) {
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
			channel = await this.container.db.youtubeChannel.create({
				data: {
					id: channelId,
					name: vtuber.name,
					englishName: vtuber.englishName,
					photo: vtuber.photo,
					org: vtuber.org,
					subOrg: vtuber.subOrg,
				},
			});
		}

		await this.container.db.subscription.upsert({
			where: {
				id_channelId: {
					id: notifChannel.id,
					channelId: channel.id,
				},
			},
			create: {
				id: notifChannel.id,
				channelId: channel.id,
				message,
			},
			update: {
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
	}

	public async chatInputYTSetQuery(interaction: Subcommand.ChatInputCommandInteraction) {
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

	public async chatInputYTRemove(interaction: Subcommand.ChatInputCommandInteraction) {
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

	public async chatInputYTList(interaction: Subcommand.ChatInputCommandInteraction) {
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

	public async chatInputTwitterUpsert(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true);
		const notifChannel = interaction.options.getChannel('channel', true, [ChannelType.GuildAnnouncement, ChannelType.GuildText]);
		const message = interaction.options.getString('message');

		await interaction.deferReply();

		try {
			await this.container.meiliClient.index('twitter-users').getDocument(handle);
		} catch {
			await interaction.editReply('This user is not on the whitelist.');
			return;
		}

		await this.container.db.twitterSubscription.upsert({
			where: {
				handle_channelId: {
					handle,
					channelId: notifChannel.id,
				},
			},
			create: {
				handle,
				channelId: notifChannel.id,
				message,
			},
			update: {
				message,
			},
		});

		await interaction.editReply(`Successfully added Twitter subscription for @${handle} in <#${notifChannel.id}>`);
	}

	public async chatInputTwitterRemove(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true);
		const notifChannel = interaction.options.getChannel('channel', true, [ChannelType.GuildAnnouncement, ChannelType.GuildText]);

		await interaction.deferReply();

		try {
			await this.container.db.twitterSubscription.delete({
				where: {
					handle_channelId: {
						handle,
						channelId: notifChannel.id,
					},
				},
			});

			await interaction.editReply(`Successfully removed Twitter subscription for @${handle} in <#${notifChannel.id}>`);
		} catch {
			await interaction.editReply('Channel was not subscribed to that user or something went wrong.');
		}
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name === 'vtuber') {
			const searchResult = await this.container.meiliClient.index('vtubers').search<VTuber>(focusedOption.value, {
				limit: 25,
			});
			await interaction.respond(searchResult.hits.map((result) => ({
				name: `${result.englishName || result.name} (${result.org})`,
				value: result.id,
			})));
		} else if (focusedOption.name === 'handle') {
			const searchResult = await this.container.meiliClient.index('twitter-users').search<{ handle: string }>(focusedOption.value, {
				limit: 25,
			});
			await interaction.respond(searchResult.hits.map((result) => ({
				name: result.handle,
				value: result.handle,
			})));
		}
	}
}
