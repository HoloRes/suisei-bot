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
						message.delete({ timeout: 4000, reason: 'Automated' });
						msg.delete({ timeout: 4000, reason: 'Automated' });
					}
				});
		});
}

// Command
exports.run = async (client, message, args) => {
	if (args.length < 3) {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}mute <user> <duration> <reason>`)
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}

	const member = await moderation.getMemberFromMessage(message, args)
		.catch((e) => {
			message.channel.send(e)
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		});

	const reason = await args.slice(2).join(' ');
	const duration = await parse(args[1], 'm'); // Parse into minutes
	if (Number.isNaN(duration) || duration === 0 || duration === null || duration === undefined) {
		return message.channel.send('Invalid duration')
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}
	if (member) confirmAndMute(message, duration, member, reason);
};

exports.config = {
	command: 'mute',
};
