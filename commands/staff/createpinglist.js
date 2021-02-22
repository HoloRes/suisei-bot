// Models
const Discord = require('discord.js');
const Sentry = require('@sentry/node');
const PingSubscription = require('$/models/pingSubscription');

// Local files
const { confirmRequest } = require('$/util/functions');
const unicodeEmojis = require('$/util/unicodeEmojis.json');
const { logger } = require('$/index');

// Functions
function createList(message, channel, emoji, emojiName, name) {
	message.reply(`are you sure you want to create a new ping list with the name ${name}?`)
		.then((msg) => {
			confirmRequest(msg, message.author.id)
				.then((result) => {
					if (result === true) {
						const embed = new Discord.MessageEmbed()
							.setTitle(name)
							.setDescription(`React with ${emoji} to subscribe to this ping list`);
						channel.send(embed)
							.then((embedMsg) => {
								embedMsg.react(emoji);
								const ping = new PingSubscription({
									_id: name,
									messageID: embedMsg.id,
									channelID: embedMsg.channel.id,
									users: [],
									emoji: emojiName,
								});
								ping.save();
								msg.edit('New list created');
							});
					} else {
						msg.edit('Action cancelled');
					}
				});
		});
}

// Command
exports.run = async (client, message, args) => {
	const channel = await client.channels.fetch(args[0])
		.catch(() => message.reply("That channel doesn't exist."));

	const name = args.slice(2).join(' ');
	await PingSubscription.findById(name).lean().exec((err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'commands', event: ['createpinglist', 'databaseSearch'] } });
		}
		if (doc) return message.reply('That list already exists.');
	});

	if (unicodeEmojis[args[1].toLowerCase()]) {
		const emoji = unicodeEmojis[args[1].toLowerCase()];
		createList(message, channel, emoji, emoji, name);
	} else {
		const emoji = message.guild.emojis.resolve(args[1]);
		if (!emoji) return message.reply("That emote doesn't exist.");

		createList(message, channel, emoji, `<:${emoji.name}:${emoji.id}>`, name);
	}
};

exports.config = {
	command: 'createpinglist',
};
