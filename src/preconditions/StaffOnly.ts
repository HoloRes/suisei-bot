import { Precondition } from '@sapphire/framework';
import type { CommandInteraction } from 'discord.js';
import { Message } from 'discord.js';

export class StaffOnlyPrecondition extends Precondition {
	public chatInputRun(interaction: CommandInteraction) {
		return this.container.config.owners?.includes(interaction.user.id)
			? this.ok()
			: this.error({ message: 'Only the bot owner can use this command!' });
	}

	public messageRun(message: Message) {
		return this.container.config.owners?.includes(message.author.id)
			? this.ok()
			: this.error({ message: 'Only the bot owner can use this command!' });
	}
}
