// Models
const axios = require('axios');
const querystring = require('query-string');
const Subscription = require('$/models/subscription');

// Local files
const config = require('$/config.json');
const { confirmRequest } = require('$/util/functions');
const { logger } = require('$/index');

exports.run = (client, message, args) => {
	if (!args[0] || !args[1]) {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}unsubscribe <YouTube channel id> <Discord channel id>`)
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}
	Subscription.findById(args[0], async (err, subscription) => {
		if (err) {
			return message.channel.send('Something went wrong, try again later.')
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}

		if (!subscription) {
			return message.channel.send("That channel doesn't exist in the database.")
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}

		const index = subscription.channels.findIndex((channel) => channel.id === args[1]);
		if (index === -1) {
			return message.channel.send("That text channel isn't subscribed to this YouTube channel.")
				.then((msg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					msg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}

		subscription.channels.splice(index, 1);
		const msg = await message.channel.send(`Are you sure you want to remove ${args[0]} from ${args[1]}?`);
		confirmRequest(msg, message.author.id)
			.then((result) => {
				msg.delete({ reason: 'Automated' });
				if (result === true) {
					if (subscription.channels.length === 0) {
						Subscription.findByIdAndDelete(subscription._id, (err2) => {
							if (err2) {
								message.channel.send('Something went wrong during deletion, try again later.')
									.then((errMsg) => {
										message.delete({ timeout: 4000, reason: 'Automated' });
										errMsg.delete({ timeout: 4000, reason: 'Automated' });
									});
							} else {
								axios({
									url: 'http://pubsubhubbub.appspot.com/',
									method: 'POST',
									headers: { 'content-type': 'application/x-www-form-urlencoded' },
									data: querystring.stringify({
										'hub.mode': 'unsubscribe',
										'hub.callback': config.PubSubHubBub.callbackUrl,
										'hub.topic': `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${subscription._id}`,
									}),
								}).then((res) => {
									if (res.status === 202) logger.debug(`Unsubscription to ${subscription._id} successful.`);
									else logger.error(`Subscription to ${subscription._id} gave response: ${res.status}`);

									message.channel.send('Subscription removal successful.')
										.then((errMsg) => {
											message.delete({ timeout: 4000, reason: 'Automated' });
											errMsg.delete({ timeout: 4000, reason: 'Automated' });
										});
								}).catch((err3) => {
									if (err3) {
										logger.error(`Error: ${err3.response.status}, unsubscription unsuccessful.`);
										message.channel.send("Something went wrong during unsubscription, notifications won't be sent anymore but do notify the Website Team of this issue.")
											.then((errMsg) => {
												message.delete({ timeout: 4000, reason: 'Automated' });
												errMsg.delete({ timeout: 4000, reason: 'Automated' });
											});
									}
								});
							}
						});
					} else {
						subscription.save((err2) => {
							if (err2) {
								logger.error(err2);
								message.channel.send('Something went wrong during the subscription removal, try again later.')
									.then((errMsg) => {
										message.delete({ timeout: 4000, reason: 'Automated' });
										errMsg.delete({ timeout: 4000, reason: 'Automated' });
									});
							} else {
								message.channel.send('Subscription removal successful.');
							}
						});
					}
				}
			});
	});
};

module.exports.config = {
	command: 'unsubscribe',
};
