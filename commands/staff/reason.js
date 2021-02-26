// Imports

// Local files
const moderation = require('$/util/moderation');
const config = require('$/config.json');

exports.run = async (client, message, args) => {
	if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}reason <case id> <reason>`);

	const caseId = Number.parseInt(args[0], 10);
	if (Number.isNaN(caseId) || caseId < 0) return message.channel.send('Invalid note id');

	const reason = args.slice(1).join(' ');
	if (reason.length === 0) return message.channel.send("Error: Reason can't be empty");
	if (reason.length > 1000) return message.channel.send('Error: Reason is over 1000 characters');

	moderation.updateReason(caseId, reason)
		.then(() => {
			message.channel.send(`Reason updated for: **#${caseId}**\n**Reason:** ${reason}`);
		})
		.catch(() => message.channel.send('Something went wrong, please try again.'));
};

exports.config = {
	command: 'reason',
};
