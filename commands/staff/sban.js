// Imports
// Packages

// Local files
const moderation = require('$/util/moderation');
const config = require('$/config.json');

// Command
exports.run = async (client, message, args) => {
	if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}sban <user> <reason>`);

	const reason = await args.slice(1).join(' ');
	if (reason.length === 0) return message.channel.send("Error: Reason can't be empty");
	if (reason.length > 1000) return message.channel.send('Error: Reason is over 1000 characters');

	return message.guild.members.ban(args[0], { reason })
		.then((user) => {
			moderation.log({
				userId: user.id,
				type: 'ban | silent',
				reason,
				moderator: message.author.id,
			}, '#f54242');
			message.channel.send(`**${user.tag}** has been banned`);
		})
		.catch(() => message.channel.send('User not found or something went wrong.'));
};

exports.config = {
	command: 'sban',
};
