// Imports
// Models

// Packages
const { scheduleJob } = require('node-schedule');
const Twitter = require('twitter-lite');
const TweetSubscription = require('$/models/tweetSubscription');

// Local imports
const { client } = require('$/index');
const config = require('$/config.json');

// Variables
const T = new Twitter(config.twitter);
let stream = null;

// Exports
function start(logger) {
	let users = '';
	TweetSubscription.find({}, async (err, docs) => {
		if (err) return logger.error(err);
		if (docs.length === 0) return logger.verbose('Not following any Twitter users.');

		// eslint-disable-next-line no-plusplus
		for (let i = 0; i < docs.length; i++) users = `${users},${docs[i]._id}`;

		stream = await T.stream('statuses/filter', { follow: users });
		stream.on('data', (tweet) => {
			TweetSubscription.findById(tweet.user.id_str, async (err2, doc) => {
				if (!doc) return;
				if (err2) return logger.error(err2);
				// eslint-disable-next-line no-plusplus
				for (let i = 0; i < doc.channels.length; i++) {
					// eslint-disable-next-line no-await-in-loop
					const channel = await client.channels.fetch(doc.channels[i])
						.catch((err3) => {
							logger.error(err3);
						});

					channel.fetchWebhooks()
						.then((hooks) => {
							logger.debug('Trying to find Twitter webhook');
							const webhook = hooks.find((wh) => wh.name.toLowerCase() === 'holotweeter');
							if (!webhook) logger.verbose(`Cannot find Twitter webhook in ${channel.id}`);
							else {
								logger.debug('Trying to send Twitter message');
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

	scheduleJob('0 0 * * 0', () => { // Automatically restart the client every Sunday
		if (stream) stream.destroy();
		setTimeout(() => { start(); }, 2000);
	});
}
exports.init = start;

exports.restart = () => {
	if (stream) stream.destroy();
	setTimeout(() => { start(); }, 2000);
};
