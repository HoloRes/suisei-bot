import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { ChannelType, EmbedBuilder } from 'discord.js';

interface IPayload {
	userId: string;
	guildId: string;
	id: number;
}

export class UnmuteTask extends ScheduledTask {
	public constructor(context: ScheduledTask.Context, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'unmute',
		});
	}

	public async run(payload: IPayload) {
		const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
			where: {
				guildId: payload.guildId,
			},
		});

		const activeMute = await this.container.db.activeMute.findUnique({
			where: {
				userId_guildId: {
					userId: payload.userId,
					guildId: payload.guildId,
				},
			},
			include: {
				hardMute: true,
			},
		});
		if (!activeMute) {
			this.container.logger.error(`Interaction[Tasks][Moderation][unmute] Unable to find active mute for log item id ${payload.id}, possibly failed to remove this task during manual unmute .`);
			return;
		}

		// Fetch the member
		const guild = await this.container.client.guilds.fetch(payload.guildId);
		let member;
		try {
			member = await guild.members.fetch(payload.userId);
		} catch {
			// Cannot find the member, likely left the server. Delete the active mute.
			this.container.db.activeMute.delete({
				where: {
					userId_guildId: {
						userId: payload.userId,
						guildId: payload.guildId,
					},
				},
			});

			if (activeMute.hardMuteId) {
				this.container.db.hardMute.delete({
					where: {
						id: activeMute.hardMuteId,
					},
				});
			}
			return;
		}

		if (activeMute.hardMute) {
			await member.roles.set(activeMute.hardMute.knownRoles, `Planned unmute for case ${payload.id}`);
		} else {
			await member.roles.remove(guildConfig.muteRole, `Planned unmute for case ${payload.id}`);
		}

		const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

		if (!logChannel) {
			this.container.logger.error(`Interaction[Tasks][Moderation][unmute] Cannot find log channel (${guildConfig.logChannel}) in ${payload.guildId!}`);
			return;
		}

		if (logChannel.type !== ChannelType.GuildText) {
			this.container.logger.error(`Interaction[Tasks][Moderation][unmute] Channel ${guildConfig.logChannel} is not text based?`);
			return;
		}

		const logEmbed = new EmbedBuilder()
			.setTitle(`unmute | case ${payload.id}`)
			.setDescription(`**Offender:** ${member.user.tag} (<@${member.id}>)\n**Reason:** Scheduled unmute`)
			.setFooter({ text: `ID: ${member.id}` })
			.setTimestamp()
			.setColor('#2bad63');

		logChannel.send({ embeds: [logEmbed] });

		this.container.db.activeMute.delete({
			where: {
				userId_guildId: {
					userId: payload.userId,
					guildId: payload.guildId,
				},
			},
		});

		if (activeMute.hardMuteId) {
			this.container.db.hardMute.delete({
				where: {
					id: activeMute.hardMuteId,
				},
			});
		}
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		unmute: never;
	}
}
