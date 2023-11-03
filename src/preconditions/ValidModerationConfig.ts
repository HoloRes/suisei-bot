import { Precondition } from '@sapphire/framework';
import type { CommandInteraction } from 'discord.js';
import { Message } from 'discord.js';

export class ValidModerationConfigPrecondition extends Precondition {
	public async chatInputRun(interaction: CommandInteraction) {
		if (!interaction.inGuild()) {
			return this.error({ message: 'This command can only be run inside a guild.' });
		}

		const config = await this.container.db.moderationGuildConfig.findUnique({
			where: {
				guildId: interaction.guildId,
			},
			select: {
				guildId: true,
			},
		});

		return config ? this.ok() : this.error({ message: 'Please set up moderation using the dashboard.' });
	}

	public async messageRun(message: Message) {
		if (!message.inGuild()) {
			return this.error({ message: 'This command can only be run inside a guild.' });
		}

		const config = await this.container.db.moderationGuildConfig.findUnique({
			where: {
				guildId: message.guildId,
			},
			select: {
				guildId: true,
			},
		});

		return config ? this.ok() : this.error({ message: 'Please set up moderation using the dashboard.' });
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/framework' {
	interface Preconditions {
		ValidModerationConfigPrecondition: never;
	}
}
