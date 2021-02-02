// Models
const Discord = require('discord.js');
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
								message.delete({ timeout: 4000, reason: 'Automated' });
								msg.delete({ timeout: 4000, reason: 'Automated' });
							});
					} else {
						msg.edit('Action cancelled');
						message.delete({ timeout: 4000, reason: 'Automated' });
						msg.delete({ timeout: 4000, reason: 'Automated' });
					}
				});
		});
}

// Command
exports.run = async (client, message, args) => {
	const channel = await client.channels.fetch(args[0])
		.catch((err) => {
			if (err) {
				return message.reply("That channel doesn't exist.")
					.then((errMsg) => {
						message.delete({ timeout: 4000, reason: 'Automated' });
						errMsg.delete({ timeout: 4000, reason: 'Automated' });
					});
			}
		});

	const name = args.slice(2).join(' ');
	await PingSubscription.findById(name).lean().exec((err, doc) => {
		if (err) logger.error(err);
		if (doc) {
			return message.reply('That list already exists.')
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}
	});

	if (unicodeEmojis[args[1].toLowerCase()]) {
		const emoji = unicodeEmojis[args[1].toLowerCase()];
		createList(message, channel, emoji, emoji, name);
	} else {
		const emoji = message.guild.emojis.resolve(args[1]);
		if (!emoji) {
			return message.reply("That emote doesn't exist.")
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}
		createList(message, channel, emoji, `<:${emoji.name}:${emoji.id}>`, name);
	}
};

module.exports.config = {
	command: 'createpinglist',
};
