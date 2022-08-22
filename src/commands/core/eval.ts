import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { Formatters, Message } from 'discord.js';
import * as util from 'util';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
	name: 'eval',
	description: 'Evaluate code',
	preconditions: ['OwnerOnly'],
})
export class EvalCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description);
		});
	}

	public override async messageRun(message: Message) {
		const args = message.content.split(' ').slice(1);

		function clean(text: string | any) {
			if (typeof (text) === 'string') return text.replace(/'/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);
			return text;
		}

		try {
			const code = args.join(' ');
			// eslint-disable-next-line no-eval
			let evaled = eval(code);

			if (typeof evaled !== 'string') { evaled = util.inspect(evaled); }

			message.channel.send(Formatters.codeBlock(clean(evaled)));
		} catch (err) {
			message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
		}
	}
}
