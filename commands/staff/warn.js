// Imports
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
					}
				});
		});
}

// Command
exports.run = async (client, message, args) => {
	if (!args[0]) return message.channel.send(`**USAGE:** ${config.discord.prefix}warn <user> <reason>`);

	const reason = await args.slice(1).join(' ');
	if (reason.length === 0) return message.channel.send("Error: Reason can't be empty");
	if (reason.length > 1000) return message.channel.send('Error: Reason is over 1000 characters');

	moderation.getMemberFromMessage(message, args)
		.then((member) => confirmAndWarn(message, member, reason))
		.catch((err) => message.channel.send(err.info));
};

exports.config = {
	command: 'warn',
};
