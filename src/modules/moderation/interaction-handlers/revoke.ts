import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { ChannelType, EmbedBuilder } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class RevokeButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction) {
		await interaction.deferReply();
		await interaction.message.edit({ embeds: interaction.message.embeds });

		const data = interaction.customId.split(':');
		const action = data[2];
		const id = data[3];

		const pendingItem = await this.container.db.moderationPendingLogItem.delete({
			where: {
				id,
			},
			include: {
				affectedCase: true,
			},
		});

		if (action === 'cancel') {
			await interaction.editReply('Revocation has been cancelled.');
		} else {
			// Must be 'confirm'
			await interaction.editReply('Revoking, please wait...');

			// Log to modlog channel
			const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
				where: {
					guildId: interaction.guildId!,
				},
			});

			const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

			if (!logChannel) {
				this.container.logger.error(`Interaction[Handlers][Moderation][revoke] Cannot find log channel (${guildConfig.logChannel}) in ${interaction.guildId!}`);
				return;
			}

			if (logChannel.type !== ChannelType.GuildText) {
				this.container.logger.error(`Interaction[Handlers][Moderation][revoke] Channel ${guildConfig.logChannel} is not text based?`);
				return;
			}

			const moderator = await this.container.client.users.fetch(pendingItem.moderatorId);

			const logItem = await this.container.db.moderationLogItem.create({
				data: {
					type: pendingItem.type,
					action: pendingItem.action,
					reason: pendingItem.reason,
					moderatorId: pendingItem.moderatorId,
					offenderId: pendingItem.offenderId,
					guildId: pendingItem.guildId,
					affectedCaseId: pendingItem.affectedCaseId,
					strikes: pendingItem.strikes,
					strikeDate: pendingItem.affectedCase!.strikeDate,
				},
			});

			const logEmbed = new EmbedBuilder()
				.setTitle(`revoke | case ${logItem.id}`)
				.setDescription(`**Affects case:** ${pendingItem.affectedCaseId}\n**Reason:** ${pendingItem.reason}\n**Moderator:** ${moderator.tag}`)
				.setFooter({ text: `ID: ${pendingItem.offenderId}` })
				.setTimestamp()
				.setColor('#2bad63');

			logChannel.send({ embeds: [logEmbed] });

			await interaction.editReply(`Revoked case ${logItem.id}`);
		}

		// Disable buttons
		await interaction.message.edit({
			content: interaction.message.content,
			embeds: interaction.message.embeds,
			components: [],
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('moderation:revoke')) return this.none();
		if (!interaction.inGuild()) return this.none();

		return this.some();
	}
}
