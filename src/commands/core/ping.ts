import { ChatInputCommand, Command } from '@sapphire/framework';
import { CommandInteraction, Message } from 'discord.js';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
	name: 'ping',
	aliases: ['pong'],
	description: 'ping pong',
	preconditions: ['OwnerOnly'],
})
export class PingCommand extends Command {
	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description);
		});
	}

	public override async chatInputRun(message: CommandInteraction) {
		await message.reply('Ping?');
		const msg = await message.fetchReply();
		if (msg instanceof Message) {
			const content = `Pong from JavaScript! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${msg.createdTimestamp - message.createdTimestamp}ms.`;
			message.editReply(content);
		}
	}

	public override async messageRun(message: Message) {
		const msg = await message.reply('Ping?');
		const content = `Pong from JavaScript! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${msg.createdTimestamp - message.createdTimestamp}ms.`;
		msg.edit(content);
	}
}
