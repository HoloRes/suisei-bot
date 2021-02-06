// Models
const Subscription = require('$/models/subscription');

// Local files
const config = require('$/config.json');
const { logger } = require('$/index');
const { confirmRequest } = require('$/util/functions');

exports.run = (client, message, args) => {
	if (!args[0]) {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}subscribe <YouTube channel id> <Discord channel id> <message>`)
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}
};

exports.config = {
	command: 'subscribe',
};
