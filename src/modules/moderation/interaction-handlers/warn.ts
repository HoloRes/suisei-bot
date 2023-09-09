import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import {
	ChannelType,
	EmbedBuilder,
} from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class WarnButtonHandler extends InteractionHandler {
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
		});

		if (action === 'cancel') {
			await interaction.editReply('Warn has been cancelled.');
		} else {
			// Must be 'confirm'
			await interaction.editReply('Warning, please wait...');
			const logItem = await this.container.db.moderationLogItem.create({
				data: {
					type: pendingItem.type,
					action: pendingItem.action,
					reason: pendingItem.reason,
					moderatorId: pendingItem.moderatorId,
					offenderId: pendingItem.offenderId,
					guildId: pendingItem.guildId,
				},
			});

			// Fetch users
			const offender = await this.container.client.users.fetch(pendingItem.offenderId);
			const moderator = await this.container.client.users.fetch(pendingItem.moderatorId);

			// Notify the user
			let notifyFailed = false;
			const notificationEmbed = new EmbedBuilder()
				.setTitle(`You've been warned in: ${interaction.guild!.name}`)
				.setDescription(`Reason: ${pendingItem.reason}`)
				.setTimestamp();

			try {
				await offender.send({ embeds: [notificationEmbed] });
			} catch {
				notifyFailed = true;
			}

			await interaction.editReply({
				content: `Warned ${offender.tag}${notifyFailed ? ', but failed to send DM notification' : ''}`,
			});

			// Log to modlog channel
			const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
				where: {
					guildId: interaction.guildId!,
				},
			});

			const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

			if (!logChannel) {
				this.container.logger.error(`Interaction[Handlers][Moderation][warn] Cannot find log channel (${guildConfig.logChannel}) in ${interaction.guildId!}`);
				return;
			}

			if (logChannel.type !== ChannelType.GuildText) {
				this.container.logger.error(`Interaction[Handlers][Moderation][warn] ${guildConfig.logChannel} is not text based?`);
				return;
			}

			const logEmbed = new EmbedBuilder()
				.setTitle(`warn | case ${logItem.id}`)
				.setDescription(`**Offender:** ${offender.tag} (<@${offender.id}>)\n**Reason:** ${pendingItem.reason}\n**Moderator:** ${moderator.tag}`)
				.setFooter({ text: `ID: ${pendingItem.offenderId}` })
				.setTimestamp()
				.setColor('#fcdc63');

			await logChannel.send({ embeds: [logEmbed] });

			// Disable buttons
			await interaction.message.edit({
				content: interaction.message.content,
				embeds: interaction.message.embeds,
				components: [],
			});
		}
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('moderation:warn')) return this.none();
		if (!interaction.inGuild()) return this.none();

		return this.some();
	}
}
