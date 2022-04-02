import { Precondition } from '@sapphire/framework';
import type { CommandInteraction } from 'discord.js';
import { Message } from 'discord.js';
import { config } from '../index';

export class OwnerOnlyPrecondition extends Precondition {
	public chatInputRun(interaction: CommandInteraction) {
		return interaction.member?.user.id === config.developer.userId
			? this.ok()
			: this.error({ message: 'Only the bot owner can use this command!' });
	}

	public messageRun(message: Message) {
		return message.author.id === config.developer.userId
			? this.ok()
			: this.error({ message: 'Only the bot owner can use this command!' });
	}
}
