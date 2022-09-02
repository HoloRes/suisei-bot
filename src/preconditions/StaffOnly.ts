import { Precondition } from '@sapphire/framework';
import type { CommandInteraction } from 'discord.js';
import { Message, Permissions } from 'discord.js';

export class StaffOnlyPrecondition extends Precondition {
	public chatInputRun(interaction: CommandInteraction) {
		if (!interaction.inGuild()) {
			return this.error({ message: 'This command cannot be used outside a guild.' });
		}

		if (this.container.config.owners?.includes(interaction.user.id)) return this.ok();

		return interaction.memberPermissions.has(Permissions.FLAGS.MANAGE_CHANNELS)
			? this.ok()
			: this.error({ message: 'Only the staff can use this command!' });
	}

	public messageRun(message: Message) {
		if (!message.inGuild()) {
			return this.error({ message: 'This command cannot be used outside a guild.' });
		}

		if (this.container.config.owners?.includes(message.author.id)) return this.ok();

		return message.member?.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS)
			? this.ok()
			: this.error({ message: 'Only the staff can use this command!' });
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/framework' {
	interface Preconditions {
		StaffOnly: never;
	}
}
