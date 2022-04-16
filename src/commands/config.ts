import { Command } from '@sapphire/framework';
import { CommandInteraction, Message } from 'discord.js';

export class ConfigCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			name: 'config',
			description: 'Update server settings',
			preconditions: ['StaffOnly'] as any,
			chatInputCommand: {
				register: false,
			},
		});
	}

	public async chatInputRun(message: CommandInteraction) {
		await message.reply('Ping?');
		const msg = await message.fetchReply();
		if (msg instanceof Message) {
			const content = `Pong from JavaScript! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${msg.createdTimestamp - message.createdTimestamp}ms.`;
			message.editReply(content);
		}
	}

	public async messageRun(message: Message) {
		const msg = await message.reply('Ping?');
		const content = `Pong from JavaScript! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${msg.createdTimestamp - message.createdTimestamp}ms.`;
		msg.edit(content);
	}
}
