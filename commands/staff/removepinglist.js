// Models
const PingSubscription = require('$/models/pingSubscription');

// Local files
const { confirmRequest } = require('$/util/functions');

exports.run = (client, message, args) => {
	PingSubscription.findById(args.join(' ')).lean().exec((err, doc) => {
		if (err) return message.channel.send('Something went wrong');
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
								if (err2) msg.edit('Something went wrong');
								else msg.edit('Removal successful.');
							});
						} else msg.edit('Cancelled.');
					});
			});
	});
};

exports.config = {
	command: 'removepinglist',
};
