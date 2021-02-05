// Models
const PingSubscription = require('$/models/pingSubscription');

// Local files
const { confirmRequest } = require('$/util/functions');
const { logger } = require('$/index');

exports.run = async (client, message, args) => {
	const channel = client.channels.fetch(args[0])
		.catch((err) => {
			logger.error(err);
			return message.channel.send("That channel doesn't exist.")
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		});
	PingSubscription.findById(args.slice(1).join(' ')).lean().exec(async (err, doc) => {
		if (!doc) {
			return message.channel.send("That list doesn't exist.")
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}

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
									message.delete({ timeout: 4000, reason: 'Automated' });
									msg.delete({ timeout: 4000, reason: 'Automated' });
								}
							});
					}
				} else {
					msg.edit('Cancelled.');
					message.delete({ timeout: 4000, reason: 'Automated' });
					msg.delete({ timeout: 4000, reason: 'Automated' });
				}
			});
	});
};

exports.config = {
	command: 'ping',
};
