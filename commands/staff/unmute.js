// Imports
// Local files
const moderation = require('$/util/moderation');
const config = require('$/config.json');
const { logger } = require('$/index');

// Models
const Setting = require('$/models/setting');

exports.run = async (client, message, args) => {
	if (args.length < 1) return message.channel.send(`**USAGE:** ${config.discord.prefix}unmute <user> <reason>`);

	const reason = (args[1] ? args.slice(1).join(' ') : 'N/A');
	if (reason.length > 1000) return message.channel.send('Error: Reason is over 1000 characters');

	const member = await moderation.getMemberFromMessage(message, args)
		.catch((err) => message.channel.send(err));

	await Setting.findById('mutedRole', (err, doc) => {
		if (err) {
			logger.error(err);
			return message.channel.send('Something went wrong, please try again.');
		}

		if (!doc) return message.channel.send("There's no mute role defined, please set one via the settings command");

		if (!member.roles.cache.has(doc.value)) return message.channel.send('This member is not muted, unable to unmute.');
	});

	moderation.unmute(member, reason, message.member)
		.then(() => {
			message.channel.send(`**${member.user.tag}** has been unmuted`);
		})
		.catch(() => message.channel.send('Something went wrong, please try again.'));
};

exports.config = {
	command: 'unmute',
};
