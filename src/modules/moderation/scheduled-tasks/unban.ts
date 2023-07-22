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

		await guild.members.unban(payload.userId, `Planned unban for temp ban ${payload.id}`);

		const item = await this.container.db.moderationLogItem.findUniqueOrThrow({
			where: {
				id: payload.id,
			},
			include: {
				offender: true,
			},
		});

		const moderationChannelConfig = await this.container.db.configValue.findUniqueOrThrow({
			where: {
				guildId_module_key: {
					guildId: payload.guildId,
					module: 'moderation',
					key: 'logChannel',
				},
			},
		});

		const logChannel = await this.container.client.channels.fetch(moderationChannelConfig.value);

		if (!logChannel) {
			this.container.logger.error(`Interaction[Handlers][Moderation][ban] Cannot find log channel (${moderationChannelConfig.value}) in ${payload.guildId!}`);
			return;
		}

		if (logChannel.type !== ChannelType.GuildText) {
			this.container.logger.error(`Interaction[Handlers][Moderation][ban] Channel ${moderationChannelConfig.value} is not text based?`);
			return;
		}

		const logEmbed = new EmbedBuilder()
			.setTitle(`#${item.id.toString()} - unban`)
			.setDescription(`**Offender:** ${item.offender.lastKnownTag} (<@${item.offenderId}>)\n**Reason:** Scheduled unban, for temp ban`)
			.setFooter({ text: `ID: ${item.offenderId}` })
			.setTimestamp();

		logChannel.send({ embeds: [logEmbed] });
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		unban: never;
	}
}
