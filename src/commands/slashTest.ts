import { Command } from '@sapphire/framework';
import { CommandInteraction, Message } from 'discord.js';
import { ModuleCommand } from '@suiseis-mic/sapphire-modules';

export class ModulePingCommand extends ModuleCommand {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			name: 'slashTest',
			description: 'slashTest command',
			moduleName: 'moderation',
		});
	}

	public async messageRun(message: Message) {
		await message.channel.send('Pong from slash');
	}

	public chatInputRun(interaction: CommandInteraction) {
		return interaction.reply('slashTest :)');
	}
}
