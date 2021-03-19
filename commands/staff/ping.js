// Imports
const Sentry = require('@sentry/node');

// Models
const PingSubscription = require('$/models/pingSubscription');

// Local files
const { confirmRequest } = require('$/util/functions');
const { logger } = require('$/index');

exports.run = async (client, message, args) => {
	const channel = await client.channels.fetch(args[0])
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'commands', event: ['ping', 'discord'] } });
			return message.channel.send("That channel doesn't exist.");
		});

	PingSubscription.findById(args.slice(1).join(' ')).lean().exec(async (err, doc) => {
		if (err) return message.channel.send('Something went wrong');
		if (!doc) return message.channel.send("That list doesn't exist.");

		const msg = await message.channel.send(`Are you sure you want to ping everyone in: ${doc._id}?`);
		confirmRequest(msg, message.author.id)
			.then((result) => {
				if (result === true) {
					let userList = doc.users.slice();
					let firstPingMsg = null;
					const loops = Math.ceil(userList.length / 95);
					// eslint-disable-next-line no-plusplus
					for (let i = 0; i < loops; i++) {
						let pingMsg = '';
						if (userList.length > 95) {
							// eslint-disable-next-line no-plusplus
							for (let x = 0; x < 95; x++) {
								pingMsg = `${pingMsg}<@${userList[x]}>`;
							}
							userList = userList.splice(0, 95);
						} else {
							// eslint-disable-next-line no-plusplus
							for (let x = 0; x < userList.length; x++) {
								pingMsg = `${pingMsg}<@${userList[x]}>`;
							}
						}
						channel.send(pingMsg)
							// eslint-disable-next-line no-loop-func
							.then((sentPingMsg) => {
								if (!firstPingMsg) firstPingMsg = sentPingMsg;
								else sentPingMsg.delete({ timeout: 1000, reason: 'Automated' });
								if (i === loops - 1) {
									sentPingMsg.edit(`Everyone in ${doc._id} has been pinged.`);
									msg.edit('Done with sending pings');
								}
							});
					}
				} else {
					msg.edit('Cancelled.');
				}
			});
	});
};

exports.config = {
	command: 'ping',
};
