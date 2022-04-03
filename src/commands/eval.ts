import { Command } from '@sapphire/framework';
import { Formatters, Message } from 'discord.js';
import * as util from 'util';

export class EvalCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			name: 'eval',
			description: 'Evaluate code',
			preconditions: ['OwnerOnly'] as any,
			chatInputCommand: {
				register: false,
			},
		});
	}

	public async messageRun(message: Message) {
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
