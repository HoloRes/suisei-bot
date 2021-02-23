// Imports
// Packages
const { MessageEmbed } = require('discord.js');

// Local files
const moderation = require('$/util/moderation');
const { confirmRequest } = require('$/util/functions');
const config = require('$/config.json');

// Functions
function confirmAndBan(users, reason, message) {
	const embed = new MessageEmbed()
		.setTitle(`Massbanning **${users.length}** users`)
		.setDescription(`Reason: ${reason}`);

	message.channel.send(embed)
		.then((msg) => {
			confirmRequest(msg, message.author.id)
				.then((result) => {
					if (result === true) {
						message.channel.send('Banning, wait for finish message.');
						moderation.massban(users, reason, message.member)
							.then((status) => {
								if (status.info) message.channel.send(`Bans succeeded, but ${status.info}`);
								else message.channel.send('Bans succeeded');
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
	if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}massban "<reason>" <ids>`);
	const reason = await args.join(' ').split('"')[1];
	if (reason.length === 0) return message.channel.send("Error: Reason can't be empty");
	if (reason.length > 1000) return message.channel.send('Error: Reason is over 1000 characters');

	const ids = await args.join(' ').split('"')[2].split(' ');
	await ids.splice(0, 1);
	confirmAndBan(ids, reason, message);
};

exports.config = {
	command: 'massban',
};
