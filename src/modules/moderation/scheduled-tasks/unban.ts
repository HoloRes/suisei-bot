import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { ChannelType, EmbedBuilder } from 'discord.js';

interface IPayload {
	userId: string;
	guildId: string;
	id: number;
}

export class UnbanTask extends ScheduledTask {
	public constructor(context: ScheduledTask.Context, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'unban',
		});
	}

	public async run(payload: IPayload) {
		const guild = await this.container.client.guilds.fetch(payload.guildId);

		await guild.members.unban(payload.userId, `Planned unban for case ${payload.id}`);

		const item = await this.container.db.moderationLogItem.findUniqueOrThrow({
			where: {
				id: payload.id,
			},
			include: {
				offender: true,
			},
		});

		const guildConfig = await this.container.db.moderationGuildConfig.findUniqueOrThrow({
			where: {
				guildId: payload.guildId,
			},
		});

		const logChannel = await this.container.client.channels.fetch(guildConfig.logChannel);

		if (!logChannel) {
			this.container.logger.error(`Interaction[Tasks][Moderation][unban] Cannot find log channel (${guildConfig.logChannel}) in ${payload.guildId!}`);
			return;
		}

		if (logChannel.type !== ChannelType.GuildText) {
			this.container.logger.error(`Interaction[Tasks][Moderation][unban] Channel ${guildConfig.logChannel} is not text based?`);
			return;
		}

		const logEmbed = new EmbedBuilder()
			.setTitle(`unban | case ${item.id}`)
			.setDescription(`**Offender:** ${item.offender.lastKnownTag} (<@${item.offenderId}>)\n**Reason:** Scheduled unban`)
			.setFooter({ text: `ID: ${item.offenderId}` })
			.setTimestamp()
			.setColor('#2bad63');

		logChannel.send({ embeds: [logEmbed] });
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		unban: never;
	}
}
