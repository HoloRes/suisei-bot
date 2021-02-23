// Imports
const Sentry = require('@sentry/node');
const { MessageEmbed } = require('discord.js');

// Local files
const config = require('$/config.json');
const { logger } = require('$/index');
const { confirmRequest } = require('$/util/functions');

// Functions
function confirmAndKick(message, query) {
	const embed = new MessageEmbed()
		.setTitle('Kicking')
		.setDescription(`Filter: ${query}`);

	message.channel.send(embed)
		.then((msg) => {
			confirmRequest(msg, message.author.id)
				.then(async (result) => {
					if (result === true) {
						const members = await message.guild.members.fetch({ query, limit: 25 })
							.catch((err) => {
								Sentry.captureException(err);
								logger.error(err, { labels: { module: 'commands', event: ['filterkick', 'discord'] } });
								return message.channel.send('Something went wrong, please try again');
							});

						await members.forEach((member) => {
							message.channel.send(`Kicking: **${member.user.tag}**`);
							member.kick();
						});

						message.channel.send(`Kicked ${members.length} members`);
					} else {
						msg.edit('Cancelled.');
					}
				});
		});
}

// Command
exports.run = async (client, message, args) => {
	if (args.length < 1) return message.channel.send(`**USAGE:** ${config.discord.prefix}filterkick <search>`);
	const query = await args.join(' ');

	confirmAndKick(message, query);
};

exports.config = {
	command: 'filterkick',
};
