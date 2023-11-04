import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'revoke',
	description: 'Revoke a strike',
	preconditions: ['ValidModerationConfig'],
})
export class RevokeCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addIntegerOption((optBuilder) => optBuilder
				.setName('caseid')
				.setDescription('Case id to revoke')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the revocation')
				.setRequired(true)
				.setMaxLength(1000)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const caseId = interaction.options.getInteger('caseid', true);
		const reason = interaction.options.getString('reason', true);

		await interaction.deferReply();

		const logItem = await this.container.db.moderationLogItem.findFirst({
			where: {
				id: caseId,
				guildId: interaction.guildId,
			},
		});

		if (!logItem) {
			await interaction.editReply('No case found with that id.');
			return;
		}

		const existingRevoke = await this.container.db.moderationLogItem.findFirst({
			where: {
				affectedCaseId: logItem.id,
				guildId: interaction.guildId,
				action: 'REVOKE',
			},
			select: {
				id: true,
			},
		});

		if (existingRevoke) {
			await interaction.editReply('This case is already revoked. Are you trying to revoke the revocation? If so, use the revocation case id.');
			return;
		}

		const reply = await interaction.fetchReply();

		const tempItem = await this.container.db.moderationPendingLogItem.create({
			data: {
				type: 'MANUAL',
				moderatorId: interaction.user.id,
				offenderId: logItem.offenderId,
				reason,
				affectedCaseId: logItem.id,
				guildId: interaction.guildId,
				action: 'REVOKE',
				strikes: logItem.strikes ? -logItem.strikes : undefined,
				messageId: reply.id,
				channelId: reply.channelId,
			},
		});

		const confirmEmbed = new EmbedBuilder()
			.setTitle(`Revoking case id ${logItem.id}`)
			.setDescription(`Reason: ${reason}`)
			.setTimestamp();

		const confirmButton = new ButtonBuilder()
			.setCustomId(`moderation:revoke:confirm:${tempItem.id}`)
			.setLabel('Confirm Ban')
			.setStyle(ButtonStyle.Danger);

		const cancelButton = new ButtonBuilder()
			.setCustomId('moderation:revoke:cancel')
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(cancelButton, confirmButton);

		await interaction.editReply({
			embeds: [confirmEmbed],
			components: [row],
		});
	}
}
