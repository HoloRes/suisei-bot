import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { ChannelType, EmbedBuilder } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class MuteButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction) {
		// TODO: Muting a user again should use the longest duration
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
			const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
				where: {
					guildId: interaction.guildId!,
				},
			});

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
				if (pendingItem.hardMute) {
					await this.container.db.hardMute.create({
						data: {
							knownRoles: offender.roles.cache.map((role) => role.id),
							relatedLogItemId: logItem.id,
						},
					});

					await offender.roles.set([guildConfig.muteRole], `Hard mute ${logItem.id}, reason: ${logItem.reason}`);
				} else {
					await offender.roles.add(guildConfig.muteRole, `Mute ${logItem.id}, reason: ${logItem.reason}`);
				}

				await interaction.editReply({
					content: `Muted ${offender.user.tag}${notifyFailed ? ', but failed to send DM notification' : ''}`,
				});
			} catch {
				await interaction.editReply(`Failed to mute ${offender.user.tag}`);
				return;
			}

			// Create unmute task
			// TODO: Actually store this
			// eslint-disable-next-line no-unused-vars
			const unmuteTask = await this.container.tasks.create(
				'unmute',
				{
					userId: pendingItem.offenderId,
					guildId: interaction.guildId,
					id: logItem.id,
					hardMute: pendingItem.hardMute,
				},
				pendingItem.duration!,
			);

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

			logChannel.send({ embeds: [logEmbed] });

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
