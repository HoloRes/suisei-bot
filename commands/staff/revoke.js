// Imports
// Packages
const moderation = require('$/util/moderation');
const config = require('$/config.json');

// Command
exports.run = async (client, message, args) => {
	if (args.length < 2) {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}revoke <case id> <reason>`)
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}

	const reason = await args.slice(1).join(' ');
	if (reason.length > 1000) {
		return message.channel.send('Error: Reason is over 1000 characters')
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}

	const caseId = Number.parseInt(args[0], 10);
	if (Number.isNaN(caseId) || caseId < 1) {
		return message.channel.send('Invalid case id')
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}

	moderation.revoke(caseId, reason, message.member)
		.then(() => {
			message.channel.send('Strike has been revoked');
		})
		.catch((err) => message.channel.send(err.info ? err.info : 'Something went wrong, please try again.'));
};

exports.config = {
	command: 'revoke',
};
