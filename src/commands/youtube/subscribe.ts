import { ChatInputCommand } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';

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
	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description)
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
						.setDescription('Channel to send notifications in')));
		});
	}

	public async chatInputAdd(interaction: Subcommand.ChatInputInteraction) {
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

		const vtuber = await this.container.holodexClient.channels.getInfo(channelId)
			.catch(() => {
				interaction.editReply('Failed to fetch VTuber');
			});
		if (!vtuber) return;

		// Find the subscription in the db
		const existingSubscription = await this.container.db.youtubeSubscription.findUnique({
			where: {
				id: channelId,
			},
		});
		if (existingSubscription) {
			// Check if the channel is already subscribed
			if (existingSubscription.channels.includes(notifChannel.id)) {
				await interaction.editReply(`<#${notifChannel.id}> was already subscribed to ${vtuber.englishName ?? vtuber.name}`);
				return;
			}

			// No, so add the channel id
			await this.container.db.youtubeSubscription.update({
				where: {
					id: channelId,
				},
				data: {
					channels: [...existingSubscription.channels, notifChannel.id],
				},
			});
		} else {
			// Row doesn't exist, create one
			await this.container.db.youtubeSubscription.create({
				data: {
					id: channelId,
					channels: [notifChannel.id],
				},
			});
		}

		await interaction.editReply(`<#${notifChannel.id}> is now subscribed to ${vtuber.englishName ?? vtuber.name}`);
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name !== 'vtuber') return;

		if (focusedOption.value === '') {
			await interaction.respond([]);
			return;
		}

		const searchResult = await this.container.holodexClient.search.autocomplete(focusedOption.value, 'channel');

		await interaction.respond(searchResult.map((result) => ({
			name: result.text ?? result.value,
			value: result.value,
		})));
	}
}
