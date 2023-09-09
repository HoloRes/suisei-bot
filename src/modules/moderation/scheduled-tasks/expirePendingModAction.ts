import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { ChannelType } from 'discord.js';

interface IPayload {
	id: string;
}

export class ExpirePendingModAction extends ScheduledTask {
	public constructor(context: ScheduledTask.Context, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'expirePendingModAction',
		});
	}

	public async run(payload: IPayload) {
		try {
			const item = await this.container.db.moderationPendingLogItem.delete({
				where: {
					id: payload.id,
				},
			});

			const channel = await this.container.client.channels.fetch(item.channelId);
			if (!channel) {
				this.container.logger.error(`Tasks[Moderation][expirePendingModAction] Couldn't find channel ${item.channelId}`);
				return;
			}

			if (channel.type !== ChannelType.GuildText) {
				this.container.logger.error(`Tasks[Moderation][expirePendingModAction] Channel ${item.channelId} is not text based?`);
				return;
			}

			const msg = await channel.messages.fetch(item.messageId);

			await msg.edit({
				content: msg.content,
				embeds: msg.embeds,
				components: [],
			});
		} catch { /* empty */ }
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		expirePendingModAction: never;
	}
}
