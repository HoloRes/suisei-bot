import { Listener } from '@sapphire/framework';
import type { ChatInputCommandDeniedPayload, UserError } from '@sapphire/framework';

export class CommandDeniedListener extends Listener {
	public run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		if (Reflect.get(Object(error.context), 'silent')) return;

		if (interaction.replied) {
			interaction.reply(error.message);
		} else {
			interaction.followUp(error.message);
		}
	}
}
