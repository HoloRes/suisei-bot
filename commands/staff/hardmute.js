// Imports
const { MessageEmbed } = require('discord.js');

// Local files
const moderation = require('$/util/moderation');
const { confirmRequest } = require('$/util/functions');
const config = require('$/config.json');

// Functions
function confirmAndMute(member, message) {
	const embed = new MessageEmbed()
		.setTitle(`Hardmuting **${member.user.tag}**`);

	message.channel.send(embed)
		.then((msg) => {
			confirmRequest(msg, message.author.id)
				.then((result) => {
					if (result === true) {
						moderation.hardmute(member, message.member)
							.then(() => {
								message.channel.send(`**${member.user.tag}** has been hardmuted`);
							})
							.catch((err) => message.channel.send(err.info || 'Something went wrong, please try again.'));
					} else {
						msg.edit('Cancelled.');
					}
				});
		});
}

// Command
exports.run = async (client, message, args) => {
	if (args.length < 1) return message.channel.send(`**USAGE:** ${config.discord.prefix}hardmute <user>`);

	moderation.getMemberFromMessage(message, args)
		.then((member) => confirmAndMute(member, message))
		.catch((err) => message.channel.send(err.info));
};

exports.config = {
	command: 'hardmute',
};
