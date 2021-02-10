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
					}
				});
		});
}

// Command
exports.run = async (client, message, args) => {
	if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}kick <user> <reason>`);

	const member = await moderation.getMemberFromMessage(message, args)
		.catch((e) => message.channel.send(e));

	const reason = await args.slice(1).join(' ');
	if (reason.length > 1000) return message.channel.send('Error: Reason is over 1000 characters');

	confirmAndKick(message, member, reason);
};

exports.config = {
	command: 'kick',
};
