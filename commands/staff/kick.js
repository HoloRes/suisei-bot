// Imports
// Packages
const { MessageEmbed } = require('discord.js');

// Local files
const moderation = require('$/util/moderation');
const { confirmRequest } = require('$/util/functions');
const config = require('$/config.json');

// Functions
function confirmAndKick(message, member, reason) {
	const embed = new MessageEmbed()
		.setTitle(`Kicking **${member.user.tag}**`)
		.setDescription(`Reason: ${reason}`);

	message.channel.send(embed)
		.then((msg) => {
			confirmRequest(msg, message.author.id)
				.then((result) => {
					if (result === true) {
						moderation.kick(member, reason, message.member)
							.then((status) => {
								if (status.info) message.channel.send(`Kick succeeded, but ${status.info}`);
								else message.channel.send(`**${member.user.tag}** has been kicked`);
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
	if (args.length < 2) {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}kick <user> <reason>`)
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
	const reason = await args.slice(1).join(' ');

	confirmAndKick(message, member, reason);
};

exports.config = {
	command: 'kick',
};
