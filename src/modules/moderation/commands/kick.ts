import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	PermissionFlagsBits,
} from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'kick',
	description: 'Kick an member',
	preconditions: ['ValidModerationConfigPrecondition'],
})
export class KickCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to kick')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the kick')
				.setRequired(true)
				.setMaxLength(1000))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('silent')
				.setDescription("The bot won't notify the user if the kick is silent")
				.setRequired(true))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('strike')
				.setDescription('Wil be recorded as a strike if true')));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		const reason = interaction.options.getString('reason', true);
		const silent = interaction.options.getBoolean('silent', true);
		const strike = interaction.options.getBoolean('strike', false) ?? false;

		await interaction.deferReply();

		await this.container.db.moderationUser.upsert({
			where: {
				id: user.id,
			},
			create: {
				id: user.id,
				lastKnownTag: user.tag,
			},
			update: {
				lastKnownTag: user.tag,
			},
		});

		const reply = await interaction.fetchReply();

		const logItem = await this.container.db.moderationPendingLogItem.create({
			data: {
				type: 'MANUAL',
				action: 'KICK',
				moderatorId: interaction.user.id,
				reason,
				offenderId: user.id,
				guildId: interaction.guildId,
				silent,
				strikes: strike ? 1 : undefined,
				messageId: reply.id,
				channelId: reply.channelId,
			},
		});

		const confirmEmbed = new EmbedBuilder()
			.setTitle(`Kicking **${user.tag}**${silent ? ' silently' : ''}`)
			.setDescription(`Reason: ${reason}`)
			.setTimestamp();

		const confirmButton = new ButtonBuilder()
			.setCustomId(`moderation:kick:confirm:${logItem.id}`)
			.setLabel('Confirm Kick')
			.setStyle(ButtonStyle.Danger);

		const cancelButton = new ButtonBuilder()
			.setCustomId(`moderation:kick:cancel:${logItem.id}`)
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(cancelButton, confirmButton);

		await interaction.editReply({
			embeds: [confirmEmbed],
			components: [row],
		});

		await this.container.tasks.create('expirePendingModAction', { id: logItem.id }, 900_000);
	}
}
