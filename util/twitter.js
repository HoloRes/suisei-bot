// Imports
const { scheduleJob } = require('node-schedule');
const Twitter = require('twitter-lite');
const Sentry = require('@sentry/node');

// Models
const TweetSubscription = require('$/models/tweetSubscription');

// Local imports
const { client, logger } = require('$/index');
const config = require('$/config.json');

Sentry.configureScope((scope) => {
	scope.setTag('module', 'twitter');
});

// Variables
const T = new Twitter(config.twitter);
let stream = null;

// Exports
function start() {
	let users = '';
	TweetSubscription.find({}, async (err, docs) => {
		if (err) {
			Sentry.captureException(err);
			return logger.error(err, { labels: { module: 'twitter', event: 'databaseSearch' } });
		}
		if (docs.length === 0) return logger.verbose('Not following any Twitter users.', { labels: { module: 'twitter' } });

		// eslint-disable-next-line no-plusplus
		for (let i = 0; i < docs.length; i++) users = `${users},${docs[i]._id}`;

		stream = await T.stream('statuses/filter', { follow: users });
		stream.on('data', (tweet) => {
			if (!tweet.user || !tweet.user.id_str) {
				logger.debug("Tweet doesn't have required properties", { labels: { module: 'twitter', event: 'tweet' } });
				return logger.debug(tweet);
			}
			TweetSubscription.findById(tweet.user.id_str, async (err2, doc) => {
				if (err2) {
					Sentry.captureException(err2);
					return logger.error(err2, { labels: { module: 'twitter', event: ['tweet', 'databaseSearch'] } });
				}
				if (!doc) return;

				// eslint-disable-next-line no-plusplus
				for (let i = 0; i < doc.channels.length; i++) {
					// eslint-disable-next-line no-await-in-loop
					const channel = await client.channels.fetch(doc.channels[i])
						.catch((err3) => {
							Sentry.captureException(err3);
							logger.error(err3, { labels: { module: 'twitter' } });
						});

					channel.fetchWebhooks()
						.then((hooks) => {
							logger.debug('Trying to find Twitter webhook', { labels: { module: 'twitter', event: 'tweet' } });
							const webhook = hooks.find((wh) => wh.name.toLowerCase() === 'holotweeter');
							if (!webhook) logger.verbose(`Cannot find Twitter webhook in ${channel.id}`, { labels: { module: 'twitter', event: 'tweet' } });
							else {
								logger.debug(`Trying to send Twitter message from @${tweet.user.screen_name}`, { labels: { module: 'twitter', event: 'tweet' } });
								webhook.send(`https://twitter.com/${tweet.user.id_str}/status/${tweet.id_str}`, {
									username: `@${tweet.user.screen_name}`,
									avatarURL: `${tweet.user.profile_image_url_https.substring(0, tweet.user.profile_image_url_https.length - 'normal.jpg'.length)}400x400.jpg`,
								});
							}
						});
				}
			});
		});
	});
}
exports.init = () => {
	start();
	scheduleJob('0 */6 * * *', () => { // Automatically restart the client every 6h
		if (stream) stream.destroy();
		setTimeout(() => { start(); }, 2000);
	});
};

exports.restart = () => {
	logger.verbose('Restarting Twitter client', { labels: { module: 'twitter' } });
	if (stream) stream.destroy();
	setTimeout(() => { start(); }, 2000);
};
