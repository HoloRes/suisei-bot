// Imports
// Packages
const { MessageEmbed } = require('discord.js');

// Local files
const moderation = require('$/util/moderation');
const { confirmRequest } = require('$/util/functions');
const config = require('$/config.json');

// Functions
function confirmAndBan(message, member, reason) {
	const embed = new MessageEmbed()
		.setTitle(`Banning **${member.user.tag}**`)
		.setDescription(`Reason: ${reason}`);

	message.channel.send(embed)
		.then((msg) => {
			confirmRequest(msg, message.author.id)
				.then((result) => {
					if (result === true) {
						moderation.ban(member, reason, message.member)
							.then((status) => {
								if (status.info) message.channel.send(`Ban succeeded, but ${status.info}`);
								else message.channel.send(`**${member.user.tag}** has been banned`);
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
	if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}ban <user> <reason>`);

	const reason = await args.slice(1).join(' ');
	if (reason.length === 0) return message.channel.send("Error: Reason can't be empty");
	if (reason.length > 1000) return message.channel.send('Error: Reason is over 1000 characters');

	moderation.getMemberFromMessage(message, args)
		.then((member) => confirmAndBan(message, member, reason))
		.catch((err) => {
			if (err.info === 'Member not found') {
				return message.guild.members.ban(args[0])
					.then((user) => {
						moderation.log({
							userId: user.id,
							type: 'ban | pre-emptive',
							reason,
							moderator: message.author.id,
						}, '#f54242');
						message.channel.send(`**${user.tag}** has been banned`);
					})
					.catch(() => message.channel.send('User not found or something went wrong.'));
			}
			message.channel.send(err.info);
		});
};

exports.config = {
	command: 'ban',
};
