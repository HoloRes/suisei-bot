import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'unmute',
	description: 'Unmute an user',
})
export class UnmuteCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to unmute')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the unmute')
				.setRequired(true)
				.setMaxLength(1000))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('revoke')
				.setDescription('Revoke the strike')
				.setRequired(true)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const reason = interaction.options.getString('reason', true);
		const revokeStrike = interaction.options.getBoolean('revoke', true);

		const offenderUser = interaction.options.getUser('user', true);
		const offenderMember = await interaction.guild!.members.fetch(offenderUser);

		if (!offenderMember) {
			await interaction.reply('User is not a member of the guild.');
			return;
		}

		await interaction.deferReply();

		// Find the mute
		const activeMute = await this.container.db.activeMute.findFirst({
			where: {
				guildId: interaction.guildId,
				userId: offenderUser.id,
			},
			include: {
				logItem: true,
				hardMute: true,
			},
		});
		if (!activeMute) {
			await interaction.editReply('Unable to find a mute for this user.');
			return;
		}

		// Find the guild config
		const guildConfig = await this.container.db.moderationGuildConfig.findUnique({
			where: {
				guildId: interaction.guildId,
			},
		});
		if (!guildConfig) {
			await interaction.editReply('Something went wrong, please try again.');
			return;
		}

		// Log action to modlog channel
		const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

		if (!logChannel) {
			this.container.logger.error(`Interaction[Commands][Moderation][unmute] Cannot find log channel (${guildConfig.logChannel}) in ${interaction.guildId}`);
			return;
		}

		if (logChannel.type !== ChannelType.GuildText) {
			this.container.logger.error(`Interaction[Commands][Moderation][unmute] Channel ${guildConfig.logChannel} is not text based?`);
			return;
		}

		// Create a new log item
		const logItem = await this.container.db.moderationLogItem.create({
			data: {
				type: 'MANUAL',
				action: 'UNMUTE',
				guildId: interaction.guildId,
				offenderId: offenderUser.id,
				moderatorId: interaction.user.id,
				reason,
				affectedCaseId: activeMute.logItem.id,
				...(revokeStrike ? ({
					strikes: -1,
					strikeDate: activeMute.logItem.strikeDate,
				}) : {}),
			},
		});

		// Remove the muterole
		if (activeMute.hardMute) {
			await offenderMember.roles.set(activeMute.hardMute.knownRoles, reason);
		} else {
			await offenderMember.roles.remove(guildConfig.muteRole, reason);
		}

		const logEmbed = new EmbedBuilder()
			.setTitle(`unmute | case ${logItem.id}`)
			.setDescription(`**Offender:** ${offenderUser.tag} (<@${offenderUser.id}>)\n**Reason:** ${reason}`)
			.setFooter({ text: `Affects: ${activeMute.logItem.id}` })
			.setTimestamp()
			.setColor('#2bad63');

		await this.container.db.activeMute.delete({
			where: {
				userId_guildId: {
					guildId: activeMute.guildId,
					userId: activeMute.userId,
				},
			},
		});

		if (activeMute.hardMuteId) {
			await this.container.db.hardMute.delete({
				where: {
					id: activeMute.hardMuteId,
				},
			});
		}

		await logChannel.send({ embeds: [logEmbed] });

		// Attempt to remove the unmute task
		const unmuteTask = await this.container.db.scheduledTask.findUnique({
			where: {
				module_task_query: {
					module: 'moderation',
					task: 'unmute',
					query: activeMute.logItem.id.toString(),
				},
			},
		});
		if (!unmuteTask) {
			this.container.logger.warn('Interaction[Commands][Moderation][unmute] Unable to find unmute task in the database.');
		} else {
			await this.container.tasks.delete(unmuteTask.jobId);
		}
	}
}
