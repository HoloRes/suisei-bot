import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { ChannelType, EmbedBuilder } from 'discord.js';

interface IPayload {
	userId: string;
	guildId: string;
	id: number;
	hardMute: boolean;
}

export class UnmuteTask extends ScheduledTask {
	public constructor(context: ScheduledTask.Context, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'unmute',
		});
	}

	public async run(payload: IPayload) {
		const guild = await this.container.client.guilds.fetch(payload.guildId);
		const member = await guild.members.fetch(payload.userId);

		const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
			where: {
				guildId: payload.guildId,
			},
		});

		if (payload.hardMute) {
			// TODO: Make this a find, delete only after success
			const hardMute = await this.container.db.hardMute.delete({
				where: {
					relatedLogItemId: payload.id,
				},
			});

			await member.roles.set(hardMute.knownRoles, `Planned unmute for case ${payload.id}`);
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
			.setFooter({ text: `ID: ${payload.id}` })
			.setTimestamp()
			.setColor('#2bad63');

		logChannel.send({ embeds: [logEmbed] });
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		unmute: never;
	}
}
