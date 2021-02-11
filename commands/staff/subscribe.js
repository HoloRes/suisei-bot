// Models
const Subscription = require('$/models/subscription');

// Local files
const config = require('$/config.json');
const { logger, holoClient } = require('$/index');
const { confirmRequest } = require('$/util/functions');

exports.run = async (client, message, args) => {
	if (!args.length < 3) return message.channel.send(`**USAGE:** ${config.discord.prefix}subscribe <YouTube channel id> <Discord channel id> <message>`);

	const channel = await holoClient.channels.getByYouTubeId(args[0])
		.catch((err) => {
			logger.error(err);
			return message.channel.send('YouTube channel not found');
		});

	const discordChannel = await client.channels.fetch(args[1])
		.catch((err) => {
			logger.error(err);
			return message.channel.send('Discord channel not found');
		});

	const existingSub = await Subscription.findById(channel.youtubeId).exec()
		.catch((err) => {
			logger.error(err);
			return message.channel.send('Something went wrong, please try again.');
		});

	const channelMsg = args.slice(2).join(' ');

	const webhooks = await discordChannel.fetchWebhooks();

	const webhook = await webhooks.find((wh) => wh.name.toLowerCase() === 'stream notification');

	if (!webhook) {
		await discordChannel.createWebhook('Stream notification')
			.catch(() => message.channel.send('Unable to create a webhook in that channel, please create one with the name `Stream notification`'));
	}

	if (existingSub) {
		// eslint-disable-next-line max-len
		const index = existingSub.channels.findIndex((docChannel) => docChannel.id === discordChannel.id);

		if (index !== -1) return message.channel.send(`${discordChannel.name} is already subscribed to ${channel.name}.`);

		existingSub.channels.push({
			id: discordChannel.id,
			message: channelMsg,
		});

		const msg = await message.channel.send(`Are you sure you want to add ${channel.name} to ${discordChannel.name} with message: \`${channelMsg}\`?`);

		confirmRequest(msg, message.author.id)
			.then((result) => {
				msg.delete({ reason: 'Automated' });
				if (result === true) {
					existingSub.save((err) => {
						if (err) {
							logger.error(err);
							message.channel.send('Something went wrong saving to the database.');
						} else {
							message.channel.send('Subscription successful.');
						}
					});
				} else {
					msg.edit('Cancelled.');
				}
			});
	} else {
		const subscription = new Subscription({
			_id: channel.youtubeId,
			channels: [{
				id: discordChannel.id,
				message: channelMsg,
			}],
		});

		const msg = await message.channel.send(`Are you sure you want to add ${channel.name} to ${discordChannel.name} with message: \`${channelMsg}\`?`);

		confirmRequest(msg, message.author.id)
			.then((result) => {
				msg.delete({ reason: 'Automated' });
				if (result === true) {
					subscription.save((err) => {
						if (err) {
							logger.error(err);
							message.channel.send('Something went wrong saving to the database.');
						} else {
							message.channel.send('Subscription successful.');
						}
					});
				} else {
					msg.edit('Cancelled.');
				}
			});
	}
};

exports.config = {
	command: 'subscribe',
};
