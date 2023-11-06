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
export class StrikeButtonHandler extends InteractionHandler {
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
			await interaction.editReply('Strike has been cancelled.');
		} else {
			// Must be 'confirm'
			const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
				where: {
					guildId: interaction.guildId!,
				},
			});

			await interaction.editReply('Striking, please wait...');
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
			const offender = await interaction.guild!.members.fetch(pendingItem.offenderId);
			const moderator = await this.container.client.users.fetch(pendingItem.moderatorId);

			// Notify the user
			let notifyFailed = false;
			let notificationEmbed: EmbedBuilder;

			try {
				switch (pendingItem.action) {
					case 'WARN': {
						notificationEmbed = new EmbedBuilder()
							.setTitle(`You've been warned in: ${interaction.guild!.name}`)
							.setDescription(`Reason: ${pendingItem.reason}`)
							.setTimestamp();
						break;
					}
					case 'MUTE': {
						notificationEmbed = new EmbedBuilder()
							.setTitle(`You've been muted in: ${interaction.guild!.name}`)
							.setDescription(`Reason: ${pendingItem.reason}`)
							.setTimestamp();

						// Create unmute task
						const unmuteTask = await this.container.tasks.create(
							'unmute',
							{
								userId: pendingItem.offenderId,
								guildId: pendingItem.guildId,
								id: logItem.id,
							},
							pendingItem.duration!,
						);

						if (!unmuteTask?.id) {
							this.container.logger.error(`Interaction[Handlers][Moderation][mute] Could not create a scheduled unmute task for ${logItem.id}`);
							await interaction.editReply('Something went wrong, try again.');
							return;
						}

						await this.container.db.scheduledTask.create({
							data: {
								module: 'moderation',
								task: 'unmute',
								query: logItem.id.toString(),
								jobId: unmuteTask.id,
							},
						});

						await this.container.db.activeMute.create({
							data: {
								guildId: pendingItem.guildId,
								userId: pendingItem.offenderId,
								logItemId: logItem.id,
							},
						});

						await offender.roles.add(guildConfig.muteRole, `Mute ${logItem.id}, reason: ${logItem.reason}`);
						break;
					}
					case 'KICK': {
						notificationEmbed = new EmbedBuilder()
							.setTitle(`You've been kicked from: ${interaction.guild!.name}`)
							.setDescription(`Reason: ${pendingItem.reason}`)
							.setTimestamp();

						await interaction.guild!.members.kick(pendingItem.offenderId, pendingItem.reason);
						break;
					}
					case 'BAN': {
						notificationEmbed = new EmbedBuilder()
							.setTitle(`You've been banned from: ${interaction.guild!.name}`)
							.setDescription(`Reason: ${pendingItem.reason}`)
							.setTimestamp();

						await interaction.guild!.members.ban(pendingItem.offenderId, {
							reason: pendingItem.reason,
							deleteMessageSeconds: pendingItem.purgeDuration ?? undefined,
						});

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
						break;
					}
					default: {
						notificationEmbed = new EmbedBuilder();
					}
				}
			} catch (e) {
				this.container.logger.error('Interaction[Handlers][Moderation][strike] Something went wrong while taking the moderation action', e);
				await interaction.editReply('Something went wrong, please try again.');
				return;
			}

			try {
				// TODO: add button with link to appeal site
				await offender.send({ embeds: [notificationEmbed] });
			} catch {
				notifyFailed = true;
			}

			// Create cross report button
			const reportButton = new ButtonBuilder()
				.setCustomId(`moderation:report:${logItem.id}`)
				.setLabel('Cross report')
				.setStyle(ButtonStyle.Danger);

			const row = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(reportButton);

			await interaction.editReply({
				content: `Striked ${offender.user.tag}${notifyFailed ? ', but failed to send DM notification' : ''}`,
				components: !pendingItem.duration ? [row] : undefined,
			});

			await this.container.retracedClient.reportEvent({
				action: 'moderation.strike',
				group: {
					id: interaction.guildId!,
					name: interaction.guild!.name,
				},
				crud: 'c',
				actor: {
					id: moderator.id,
					name: moderator.tag,
				},
				target: {
					id: offender.id,
					name: offender.user.tag,
					type: 'User',
				},
				created: logItem.date,
				fields: {
					action: pendingItem.action,
					logItemId: logItem.id.toString(),
				},
			});

			// Log to modlog channel
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
				.setTitle(`strike | case ${logItem.id}`)
				// eslint-disable-next-line no-nested-ternary
				.setDescription(`**Offender:** ${offender.user.tag} (<@${offender.id}>)\n**Reason:** ${pendingItem.reason}\n**Moderator:** ${moderator.tag}\n**Duration:** ${pendingItem.duration ? this.container.humanizeDuration(pendingItem.duration) : pendingItem.action === 'BAN' ? 'Permanent' : ''}`)
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
		if (!interaction.customId.startsWith('moderation:strike')) return this.none();
		if (!interaction.inGuild()) return this.none();

		return this.some();
	}
}
