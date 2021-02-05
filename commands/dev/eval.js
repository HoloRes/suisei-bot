// Imports
// Packages
const util = require('util');

exports.run = (client, message, args) => {
	function clean(text) {
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
};

exports.config = {
	command: 'eval',
};
