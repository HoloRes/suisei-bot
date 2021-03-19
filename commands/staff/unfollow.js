// Imports
const Sentry = require('@sentry/node');

// Models
const Twitter = require('twitter-lite');
const TweetSubscription = require('$/models/tweetSubscription');

// Local imports
const config = require('$/config.json');
const { confirmRequest } = require('$/util/functions');
const { logger } = require('$/index');
const { restart } = require('$/util/twitter');

// Variables
const T = new Twitter(config.twitter);

exports.run = async (client, message, args) => {
	if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}unfollow <Twitter @name (without @)> <Discord channel id>`);

	const users = await T.get('users/lookup', { screen_name: args[0] })
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'commands', event: ['unfollow', 'twitter', 'users/lookup'] } });
			return message.channel.send("Couldn't find this user, please try again.");
		});

	if (!users[0]) return message.channel.send("Couldn't find this user, please try again.");

	TweetSubscription.findById(users[0].id_str, (err, doc) => {
		if (err) return message.channel.send('Something went wrong, try again later.');
		if (!doc) return message.channel.send("That Twitter account doesn't exist in the database.");

		const index = doc.channels.findIndex((channel) => channel.id === args[1]);
		if (index === -1) return message.channel.send("That text channel isn't following this Twitter user.");

		doc.channels.splice(index, 1);
		const msg = message.channel.send(`Are you sure you want to remove @${args[0]} from ${args[1]}?`)
			.catch((err2) => {
				Sentry.captureException(err2);
				logger.error(err2, { labels: { module: 'commands', event: ['unfollow', 'discord'] } });
				message.channel.send('Something went wrong during deletion, try again later.');
			});

		confirmRequest(msg, message.author.id)
			.then((result) => {
				msg.delete({ reason: 'Automated' });
				if (result === true) {
					if (doc.channels.length === 0) {
						doc.findByIdAndDelete(doc._id, (err2) => {
							if (err2) {
								Sentry.captureException(err2);
								logger.error(err2, { labels: { module: 'commands', event: ['unfollow', 'databaseSearch'] } });
								message.channel.send('Something went wrong during deletion, try again later.');
							} else {
								restart();
								message.channel.send('Unfollow successful.');
							}
						});
					} else {
						doc.save((err2) => {
							if (err2) {
								Sentry.captureException(err2);
								logger.error(err2, { labels: { module: 'commands', event: ['unfollow', 'databaseSearch'] } });
								message.channel.send('Something went wrong during unfollowing, try again later.');
							} else {
								message.channel.send('Unfollow successful.');
							}
						});
					}
				}
			});
	});
};

exports.config = {
	command: 'unfollow',
};
