// Imports
const Sentry = require('@sentry/node');
const { MessageEmbed } = require('discord.js');
const config = require('$/config.json');
const { client } = require('$/index');

// Init
Sentry.configureScope((scope) => {
	scope.setTag('module', 'functions');
});

// Functions
exports.confirmRequest = (msg, authorId) => new Promise((resolve, reject) => {
	try {
		msg.react('726782736617963561').then(() => { // Confirm reaction
			msg.react('726785875215777823'); // Cancel reaction
		});
		const filter = (reaction, user) => ['726782736617963561', '726785875215777823'].includes(reaction.emoji.id) && user.id === authorId;
		const collector = msg.createReactionCollector(filter, { time: 30000 });

		collector.on('collect', (r) => {
			collector.stop();
			if (r.emoji.id === '726782736617963561') {
				resolve(true);
			} else resolve(false);
		});

		collector.on('end', (collected) => {
			if (collected.size === 0) resolve(false);
		});
	} catch (e) {
		reject(new Error(e));
	}
});

exports.previewMessageHandler = async (message) => {
	const urlRegex = /https:\/\/(((canary)|(ptb))\.)?discord(app)?\.com\/channels\/[0-9]{18}\/[0-9]{18}\/[0-9]{18}/gi;
	const idRegex = /[0-9]{18}/g;

	// eslint-disable-next-line max-len
	if (!urlRegex.test(message.content) || config.previewApprovedChannels.indexOf(message.channel.id) === -1) return;

	const ids = message.content.match(urlRegex)[0].match(idRegex);

	const guild = await client.guilds.fetch(ids[0])
		.catch(() => message.channel.send('Cannot find the linked message.'));

	if (!guild.channels.cache.has(ids[1])) return message.channel.send('Cannot find the linked message.');

	const channel = guild.channels.cache.get(ids[1]);

	const msg = await channel.messages.fetch(ids[2])
		.catch(() => message.channel.send('Cannot find the linked message.'));

	let embed = new MessageEmbed()
		.setAuthor(`${msg.author.tag} - ${msg.author.id}`, msg.author.avatarURL())
		.setURL(msg.url)
		.setTimestamp(msg.createdAt);

	if (msg.content) embed = embed.setDescription(msg.content);
	let attachmentsString = '';
	let i = 1;
	msg.attachments.each((attachment) => {
		attachmentsString += `[Attachment ${i}](${attachment.url})`;
		i += 1;
	});
	if (attachmentsString.length > 0) embed = embed.addField('Attachments', attachmentsString);

	message.channel.send(embed);
};
