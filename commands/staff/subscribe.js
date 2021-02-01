// Models
const { google } = require('googleapis');
const Subscription = require('$/models/subscription');

// Local files
const config = require('$/config.json');
const { logger } = require('$/index');
const { confirmRequest } = require('$/util/functions');
const { planLivestreams } = require('$/util/youtube');

// Modules

// Init
const YT = google.youtube('v3');

// Functions
function checkExistingAndSubscribe(message, subscription, wh, res, channel, channelMsg) {
	Subscription.findById(subscription._id, async (err, sub) => {
		if (!err) {
			if (sub) {
				const index = sub.channels.findIndex((docChannel) => docChannel.id === channel.id);
				if (index !== -1) {
					return message.channel.send(`${channel.name} is already subscribed to ${res.data.items[0].snippet.title}.`)
						.then((errMsg) => {
							message.delete({ timeout: 4000, reason: 'Automated' });
							errMsg.delete({ timeout: 4000, reason: 'Automated' });
						});
				}
				sub.channels.push({
					id: channel.id,
					message: channelMsg,
				});
				const msg = await message.channel.send(`Are you sure you want to add ${res.data.items[0].snippet.title} to ${channel.name}?`)
					.catch((err2) => {
						logger.error(err2);
						message.channel.send(err2)
							.then((errMsg) => {
								message.delete({ timeout: 4000, reason: 'Automated' });
								errMsg.delete({ timeout: 4000, reason: 'Automated' });
							});
					});
				confirmRequest(msg, message.author.id)
					.then((result) => {
						msg.delete({ reason: 'Automated' });
						if (result === true) {
							sub.save((err2) => {
								if (err2) {
									logger.error(err2);
									message.channel.send('Something went wrong saving to the database.')
										.then((errMsg) => {
											message.delete({ timeout: 4000, reason: 'Automated' });
											errMsg.delete({ timeout: 4000, reason: 'Automated' });
										});
								} else {
									message.channel.send('Subscription successful.')
										.then((errMsg) => {
											message.delete({ timeout: 4000, reason: 'Automated' });
											errMsg.delete({ timeout: 4000, reason: 'Automated' });
										});
								}
							});
						}
					});
			}
			message.channel.send(`Adding ${res.data.items[0].snippet.title} to ${channel.name} with message \`${channelMsg}\`?`).then((msg) => {
				confirmRequest(msg, message.author.id)
					.then((result) => {
						if (result === true) {
							msg.delete({ timeout: 2000, reason: 'Automated' });
							subscription.save((err2) => {
								if (err) {
									logger.error(err2);
									message.channel.send('Something went wrong during the subscription, try again later.')
										.then((errMsg) => {
											message.delete({ timeout: 4000, reason: 'Automated' });
											errMsg.delete({ timeout: 4000, reason: 'Automated' });
										});
								} else {
									planLivestreams(subscription._id);
									message.channel.send('Subscription successful.')
										.then((errMsg) => {
											message.delete({ timeout: 4000, reason: 'Automated' });
											errMsg.delete({ timeout: 4000, reason: 'Automated' });
										});
								}
							});
						} else {
							msg.edit('Cancelled.');
							msg.delete({ timeout: 4000, reason: 'Automated' });
							message.delete({ timeout: 4000, reason: 'Automated' });
						}
					});
			});
		}
	});
}

// Command
exports.run = (client, message, args) => {
	if (!args[0]) {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}subscribe <YouTube channel id> <Discord channel id> <message>`)
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}
	YT.channels.list({
		auth: config.YtApiKey,
		id: args[0],
		part: 'snippet',
	}, (err, res) => {
		if (err) {
			return message.channel.send('Something went wrong, try again later.')
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}

		if (res.data.pageInfo.totalResults === 0) {
			message.channel.send('That is an invalid channel id.')
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		} else {
			client.channels.fetch(args[1])
				.then(async (channel) => {
					const subscription = new Subscription({
						_id: res.data.items[0].id,
						channels: [{
							id: channel.id,
							message: args.slice(2).join(' '),
						}],
					});

					await channel.fetchWebhooks()
						.then(async (hooks) => {
							const existingWebhook = await hooks.find((wh) => wh.name.toLowerCase() === 'stream notification');
							if (!existingWebhook) {
								channel.createWebhook('Stream notification')
									.then((webhook) => {
										checkExistingAndSubscribe(message, subscription, webhook, res, channel, args.slice(2).join(' '));
									})
									.catch((err2) => {
										logger.error(err2);
										return message.channel.send('Unable to create a webhook in that channel, please create one with the name `Stream notification`').then((msg) => {
											message.delete({ timeout: 4000, reason: 'Automated' });
											msg.delete({ timeout: 4000, reason: 'Automated' });
										});
									});
							} else checkExistingAndSubscribe(message, subscription, existingWebhook, res, channel, args.slice(2).join(' '));
						});
				})
				.catch((err2) => {
					logger.error(err2);
					message.channel.send("That channel doesn't exist.").then((errMsg) => {
						message.delete({ timeout: 4000, reason: 'Automated' });
						errMsg.delete({ timeout: 4000, reason: 'Automated' });
					});
				});
		}
	});
};

module.exports.config = {
	command: 'subscribe',
};
