import * as util from 'util';
import { Command } from '@sapphire/framework';
import { codeBlock, Message } from 'discord.js';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
	name: 'eval',
	description: 'Evaluate code',
	preconditions: ['OwnerOnly'],
})
export class EvalCommand extends Command {
	public override async messageRun(message: Message) {
		const args = message.content.split(' ').slice(1);

		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		function clean(text: string | any) {
			if (typeof (text) === 'string') return text.replace(/'/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return text;
		}

		try {
			const code = args.join(' ');
			// eslint-disable-next-line no-eval,@typescript-eslint/no-unsafe-assignment
			let evaled = eval(code);

			if (typeof evaled !== 'string') { evaled = util.inspect(evaled); }

			await message.channel.send(codeBlock(clean(evaled)));
		} catch (err) {
			await message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
		}
	}
}
