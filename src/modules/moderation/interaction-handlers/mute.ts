import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { ChannelType, EmbedBuilder } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class MuteButtonHandler extends InteractionHandler {
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
			await interaction.editReply('Mute has been cancelled.');
		} else {
			const existingMute = await this.container.db.activeMute.findUnique({
				where: {
					userId_guildId: {
						userId: pendingItem.offenderId,
						guildId: pendingItem.guildId,
					},
				},
				include: {
					logItem: true,
				},
			});
			if (existingMute) {
				// eslint-disable-next-line max-len
				const oldMuteEndDate = BigInt(existingMute.logItem.date.getTime()) + existingMute.logItem.duration!;
				const newMuteEndDate = Date.now() + pendingItem.duration!;

				if (oldMuteEndDate > newMuteEndDate) {
					await interaction.editReply('Cannot mute, new mute ends before existing mute.');
					return;
				}
			}

			const guildConfig = await this.container.db.moderationGuildConfig.findUnique({
				where: {
					guildId: interaction.guildId!,
				},
			});
			if (!guildConfig) {
				await interaction.editReply('Something went wrong, please try again.');
				return;
			}

			// Fetch users
			const moderator = await this.container.client.users.fetch(pendingItem.moderatorId);
			const offender = await interaction.guild!.members.fetch(pendingItem.offenderId);

			// Must be 'confirm'
			await interaction.editReply('Muting, please wait...');
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

			await this.container.retracedClient.reportEvent({
				action: 'moderation.mute',
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
					logItemId: logItem.id.toString(),
				},
			});

			// Notify the user
			let notifyFailed = false;
			if (!pendingItem.silent) {
				const notificationEmbed = new EmbedBuilder()
					.setTitle(`You've been muted in: ${interaction.guild!.name}`)
					.setDescription(`Reason: ${pendingItem.reason}`)
					.setTimestamp();

				try {
					// TODO: add button with link to appeal site
					await offender.send({ embeds: [notificationEmbed] });
				} catch {
					notifyFailed = true;
				}
			}

			// Attempt the mute
			try {
				// Add mute role
				if (pendingItem.hardMute && !existingMute?.hardMuteId) {
					// Only create a new hardmute when there's not an existing hardmute.
					const hardMute = await this.container.db.hardMute.create({
						data: {
							knownRoles: offender.roles.cache.map((role) => role.id),
						},
					});

					await this.container.db.activeMute.upsert({
						where: {
							userId_guildId: {
								guildId: pendingItem.guildId,
								userId: pendingItem.offenderId,
							},
						},
						create: {
							guildId: pendingItem.guildId,
							userId: pendingItem.offenderId,
							hardMuteId: hardMute?.id,
							logItemId: logItem.id,
						},
						update: {
							hardMuteId: hardMute.id,
							logItemId: logItem.id,
						},
					});

					await offender.roles.set([guildConfig.muteRole], `Hard mute ${logItem.id}, reason: ${logItem.reason}`);
				} else {
					await this.container.db.activeMute.upsert({
						where: {
							userId_guildId: {
								guildId: pendingItem.guildId,
								userId: pendingItem.offenderId,
							},
						},
						create: {
							guildId: pendingItem.guildId,
							userId: pendingItem.offenderId,
							hardMuteId: existingMute?.hardMuteId ?? null,
							logItemId: logItem.id,
						},
						update: {
							hardMuteId: existingMute?.hardMuteId ?? null,
							logItemId: logItem.id,
						},
					});

					await offender.roles.add(guildConfig.muteRole, `Mute ${logItem.id}, reason: ${logItem.reason}`);
				}

				await interaction.editReply({
					content: `Muted ${offender.user.tag}${notifyFailed ? ', but failed to send DM notification' : ''}`,
				});
			} catch (e) {
				this.container.logger.error('');
				await interaction.editReply(`Failed to mute ${offender.user.tag}`);
				return;
			}

			// Log to modlog channel
			const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

			if (!logChannel) {
				this.container.logger.error(`Interaction[Handlers][Moderation][mute] Cannot find log channel (${guildConfig.logChannel}) in ${interaction.guildId!}`);
				return;
			}

			if (logChannel.type !== ChannelType.GuildText) {
				this.container.logger.error(`Interaction[Handlers][Moderation][mute] Channel ${guildConfig.logChannel} is not text based?`);
				return;
			}

			const logEmbed = new EmbedBuilder()
				.setTitle(`mute${pendingItem.silent ? ' (silent)' : ''}${pendingItem.hardMute ? ' (hardmute)' : ''} | case ${logItem.id}`)
				.setDescription(`**Offender:** ${offender.user.tag} (<@${offender.id}>)\n**Reason:** ${pendingItem.reason}\n**Moderator:** ${moderator.tag}\n**Duration:** ${this.container.humanizeDuration(pendingItem.duration!)}`)
				.setFooter({ text: `ID: ${pendingItem.offenderId}` })
				.setTimestamp()
				.setColor('#ff9d24');

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
		if (!interaction.customId.startsWith('moderation:mute')) return this.none();
		if (!interaction.inGuild()) return this.none();

		return this.some();
	}
}
