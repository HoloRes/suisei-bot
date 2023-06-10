import { Listener } from '@sapphire/framework';
import type { ChatInputCommandDeniedPayload, UserError } from '@sapphire/framework';

export class CommandDeniedListener extends Listener {
	public async run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		if (Reflect.get(Object(error.context), 'silent')) return;

		if (interaction.replied) {
			await interaction.reply(error.message);
		} else {
			await interaction.followUp(error.message);
		}
	}
}
