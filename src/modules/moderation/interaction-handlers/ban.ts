import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
} from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class BanButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction) {
		// TODO: Banning a user again should use the longest duration
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
			await interaction.editReply('Ban has been cancelled.');
		} else {
			// Must be 'confirm'
			await interaction.editReply('Banning, please wait...');
			const logItem = await this.container.db.moderationLogItem.create({
				data: {
					type: pendingItem.type,
					action: pendingItem.action,
					reason: pendingItem.reason,
					moderatorId: pendingItem.moderatorId,
					duration: pendingItem.duration,
					offenderId: pendingItem.offenderId,
					guildId: pendingItem.guildId,
					strikes: pendingItem.strikes,
				},
			});

			// Fetch users
			const offender = await this.container.client.users.fetch(pendingItem.offenderId);
			const moderator = await this.container.client.users.fetch(pendingItem.moderatorId);

			// Notify the user
			let notifyFailed = false;
			if (!pendingItem.silent) {
				const notificationEmbed = new EmbedBuilder()
					.setTitle(`You've been banned from: ${interaction.guild!.name}`)
					.setDescription(`Reason: ${pendingItem.reason}`)
					.setTimestamp();

				try {
					// TODO: add button with link to appeal site
					await offender.send({ embeds: [notificationEmbed] });
				} catch {
					notifyFailed = true;
				}
			}

			// Create cross report button
			const reportButton = new ButtonBuilder()
				.setCustomId(`moderation:report:${logItem.id}`)
				.setLabel('Cross report')
				.setStyle(ButtonStyle.Danger);

			const row = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(reportButton);

			// Attempt the ban
			try {
				await interaction.guild!.members.ban(pendingItem.offenderId, {
					reason: pendingItem.reason,
				});
				await interaction.editReply({
					content: `Banned ${offender.tag}${notifyFailed ? ', but failed to send DM notification' : ''}`,
					components: !pendingItem.duration ? [row] : undefined,
				});
			} catch {
				await interaction.editReply(`Failed to ban ${offender.tag}`);
				return;
			}

			// Create unban task if tempban
			if (pendingItem.duration) {
				await this.container.tasks.create(
					'unban',
					{
						userId: pendingItem.offenderId,
						guildId: interaction.guildId,
						id: logItem.id,
					},
					pendingItem.duration,
				);
			}

			// Log to modlog channel
			const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
				where: {
					guildId: interaction.guildId!,
				},
			});

			const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

			if (!logChannel) {
				this.container.logger.error(`Interaction[Handlers][Moderation][ban] Cannot find log channel (${guildConfig.logChannel}) in ${interaction.guildId!}`);
				return;
			}

			if (logChannel.type !== ChannelType.GuildText) {
				this.container.logger.error(`Interaction[Handlers][Moderation][ban] Channel ${guildConfig.logChannel} is not text based?`);
				return;
			}

			const logEmbed = new EmbedBuilder()
				.setTitle(`ban${pendingItem.silent ? ' (silent)' : ''} | case ${logItem.id}`)
				.setDescription(`**Offender:** ${offender.tag} (<@${offender.id}>)\n**Reason:** ${pendingItem.reason}\n**Moderator:** ${moderator.tag}\n**Duration:** ${pendingItem.duration ? this.container.humanizeDuration(pendingItem.duration) : 'Permanent'}`)
				.setFooter({ text: `ID: ${pendingItem.offenderId}` })
				.setTimestamp()
				.setColor('#f54242');

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
		if (!interaction.customId.startsWith('moderation:ban')) return this.none();
		if (!interaction.inGuild()) return this.none();

		return this.some();
	}
}
