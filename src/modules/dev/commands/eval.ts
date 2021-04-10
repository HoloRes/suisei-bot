// Imports
import util from 'util';
import Discord from 'discord.js';

export function run(client: Discord.Client, message: Discord.Message, args: string[]): void {
	function clean(text: string | any) {
		if (typeof (text) === 'string') return text.replace(/'/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);
		return text;
	}
	try {
		const code = args.join(' ');
		// eslint-disable-next-line no-eval
		let evaled = eval(code);

		if (typeof evaled !== 'string') { evaled = util.inspect(evaled); }

		message.channel.send(clean(evaled), { code: 'xl' });
	} catch (err) {
		message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
	}
}

export const config = {
	command: 'eval',
};
