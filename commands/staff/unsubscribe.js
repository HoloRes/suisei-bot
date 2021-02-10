// Models
const Subscription = require('$/models/subscription');

// Local files
const config = require('$/config.json');
const { confirmRequest } = require('$/util/functions');
const { logger } = require('$/index');

exports.run = (client, message, args) => {
	if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}unsubscribe <YouTube channel id> <Discord channel id>`);

	Subscription.findById(args[0], async (err, subscription) => {
		if (err) return message.channel.send('Something went wrong, try again later.');
		if (!subscription) return message.channel.send("That channel doesn't exist in the database.");

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
								logger.error(err2);
								message.channel.send('Something went wrong during deletion, try again later.');
							} else {
								message.channel.send('Subscription removal successful.');
							}
						});
					} else {
						subscription.save((err2) => {
							if (err2) {
								logger.error(err2);
								message.channel.send('Something went wrong during the subscription removal, try again later.');
							} else {
								message.channel.send('Subscription removal successful.');
							}
						});
					}
				}
			});
	});
};

exports.config = {
	command: 'unsubscribe',
};
