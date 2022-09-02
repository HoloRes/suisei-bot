import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { MessageEmbed } from 'discord.js';

@ApplyOptions<Subcommand.Options>({
	name: 'subscriptions',
	description: 'Manage YouTube notification subscriptions',
	subcommands: [
		{
			name: 'add',
			chatInputRun: 'chatInputAdd',
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
	public async chatInputAdd(interaction: Subcommand.ChatInputInteraction) {
		const channelId = interaction.options.getString('vtuber', true);
		const notifChannel = interaction.options.getChannel('channel', true);
		const message = interaction.options.getString('message', true);

		// Check if the notification channel is a text channel
		if (notifChannel.type !== 'GUILD_NEWS' && notifChannel.type !== 'GUILD_TEXT') {
			await interaction.reply({
				content: 'Selected channel is not a text channel.',
				ephemeral: true,
			});
			return;
		}
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
				await interaction.editReply(`<#${notifChannel.id}> was already subscribed to ${channel.englishName ?? channel.name}`);
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
				await notifChannel.createWebhook('Stream notification');
			}

			await interaction.editReply(`<#${notifChannel.id}> is now subscribed to ${channel.englishName ?? channel.name}`);
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

		await interaction.editReply(`<#${notifChannel.id}> is now subscribed to ${vtuber.englishName ?? vtuber.name}`);
	}

	public async chatInputRemove(interaction: Subcommand.ChatInputInteraction) {
		const channelId = interaction.options.getString('vtuber', true);
		const notifChannel = interaction.options.getChannel('channel', true);

		// Check if the notification channel is a text channel
		if (notifChannel.type !== 'GUILD_NEWS' && notifChannel.type !== 'GUILD_TEXT') {
			await interaction.reply({
				content: 'Selected channel is not a text channel.',
				ephemeral: true,
			});
			return;
		}
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

			await interaction.editReply(`<#${notifChannel.id}> has unsubscribed from ${channel.englishName ?? channel.name}`);
			return;
		}

		await interaction.editReply(`<#${notifChannel.id}> is not subscribed to ${channel.englishName ?? channel.name}`);
	}

	public async chatInputList(interaction: Subcommand.ChatInputInteraction) {
		const channel = interaction.options.getChannel('channel', true);
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
			template: new MessageEmbed({
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
					.setTitle(subscription.channel.englishName ?? subscription.channel.name)
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

		if (focusedOption.value === '') {
			await interaction.respond([]);
			return;
		}

		const searchResult = await this.container.db.youtubeChannel.findMany({
			where: {
				OR: [
					{
						name: {
							contains: focusedOption.value,
						},
					},
					{
						englishName: {
							contains: focusedOption.value,
						},
					},
					{
						org: {
							contains: focusedOption.value,
						},
					},
					{
						id: {
							contains: focusedOption.value,
						},
					},
				],
			},
			select: {
				name: true,
				englishName: true,
				org: true,
				id: true,
			},
			take: 25,
		});

		await interaction.respond(searchResult.map((result) => ({
			name: `${result.englishName ?? result.name} (${result.org})`,
			value: result.id,
		})));
	}
}
