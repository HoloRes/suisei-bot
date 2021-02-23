// Imports
// Packages
const { MessageEmbed } = require('discord.js');
const parse = require('parse-duration');
const moment = require('moment');
const humanizeDuration = require('humanize-duration');

// Local files
const moderation = require('$/util/moderation');
const { confirmRequest } = require('$/util/functions');
const config = require('$/config.json');

// Functions
function confirmAndMute(message, duration, member, reason) {
	const embed = new MessageEmbed()
		.setTitle(`Muting **${member.user.tag}** for **${humanizeDuration(moment.duration(duration, 'minutes').asMilliseconds())}**`)
		.setDescription(`Reason: ${reason}`);

	message.channel.send(embed)
		.then((msg) => {
			confirmRequest(msg, message.author.id)
				.then((result) => {
					if (result === true) {
						moderation.mute(member, duration, reason, message.member)
							.then((status) => {
								if (status.info) message.channel.send(`Mute succeeded, but ${status.info}`);
								else message.channel.send(`**${member.user.tag}** has been muted`);
							})
							.catch(() => message.channel.send('Something went wrong, please try again.'));
					} else {
						msg.edit('Cancelled.');
					}
				});
		});
}

// Command
exports.run = async (client, message, args) => {
	if (args.length < 3) return message.channel.send(`**USAGE:** ${config.discord.prefix}mute <user> <duration> <reason>`);

	const reason = await args.slice(2).join(' ');
	if (reason.length === 0) return message.channel.send("Error: Reason can't be empty");
	if (reason.length > 1000) return message.channel.send('Error: Reason is over 1000 characters');

	const duration = await parse(args[1], 'm'); // Parse into minutes
	if (Number.isNaN(duration) || duration === 0 || duration === null || duration === undefined) return message.channel.send('Invalid duration');

	moderation.getMemberFromMessage(message, args)
		.then((member) => confirmAndMute(message, duration, member, reason))
		.catch((err) => message.channel.send(err.info));
};

exports.config = {
	command: 'mute',
};
