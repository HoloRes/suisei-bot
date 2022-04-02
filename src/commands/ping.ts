import { Command } from '@sapphire/framework';
import { CommandInteraction, Message } from 'discord.js';

export class PingCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			name: 'ping',
			aliases: ['pong'],
			description: 'ping pong',
			preconditions: ['OwnerOnly'] as any,
			chatInputCommand: {
				register: true,
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
}
