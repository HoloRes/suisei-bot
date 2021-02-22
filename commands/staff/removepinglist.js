// Imports
const Sentry = require('@sentry/node');

// Models
const PingSubscription = require('$/models/pingSubscription');

// Local files
const { logger } = require('$/index');
const { confirmRequest } = require('$/util/functions');

exports.run = (client, message, args) => {
	PingSubscription.findById(args.join(' ')).lean().exec((err, doc) => {
		if (err) {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'commands', event: ['removepinglist', 'databaseSearch'] } });
			return message.channel.send('Something went wrong');
		}
		if (!doc) return message.channel.send("That list doesn't exist.");

		message.channel.send('Are you sure you want to delete this list?')
			.then((msg) => {
				confirmRequest(msg, message.author.id)
					.then((result) => {
						if (result === true) {
							client.channels.fetch(doc.channelID)
								.then((channel) => {
									channel.messages.fetch(doc.messageID)
										.then((reactMsg) => reactMsg.delete());
								});
							PingSubscription.findByIdAndRemove(args.join(' '), (err2) => {
								if (err2) {
									Sentry.captureException(err2);
									logger.error(err2, { labels: { module: 'commands', event: ['removepinglist', 'databaseSearch'] } });
									msg.edit('Something went wrong');
								} else msg.edit('Removal successful.');
							});
						} else msg.edit('Cancelled.');
					});
			});
	});
};

exports.config = {
	command: 'removepinglist',
};
