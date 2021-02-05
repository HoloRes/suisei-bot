// Imports
// Packages
const { MessageEmbed } = require('discord.js');

// Local files
const moderation = require('$/util/moderation');
const { confirmRequest } = require('$/util/functions');
const config = require('$/config.json');

// Functions
function confirmAndWarn(message, member, reason) {
	const embed = new MessageEmbed()
		.setTitle(`Warning **${member.user.tag}**`)
		.setDescription(`Reason: ${reason}`);

	message.channel.send(embed)
		.then((msg) => {
			confirmRequest(msg, message.author.id)
				.then((result) => {
					if (result === true) {
						moderation.warn(member, reason, message.member)
							.then((status) => {
								if (status.info) message.channel.send(`Warn succeeded, but ${status.info}`);
								else message.channel.send(`**${member.user.tag}** has been warned`);
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
	if (!args[0]) {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}warn <user> <reason>`)
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

	const member = await moderation.getMemberFromMessage(message, args)
		.catch(() => message.channel.send('Member not found')
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			}));

	confirmAndWarn(message, member, reason);
};

exports.config = {
	command: 'warn',
};
