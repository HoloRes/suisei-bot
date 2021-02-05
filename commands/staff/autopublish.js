// Imports
// Models
const AutoPublish = require('$/models/publish');

// Local imports
const { logger } = require('$/index');
const config = require('$/config.json');

exports.run = async (client, message, args) => {
	if (!args[0]) {
		return message.channel.send(`**USAGE:** ${config.discord.prefix}autopublish <Discord channel id>`)
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	}

	const channel = client.channels.fetch(args[0])
		.catch((err) => {
			logger.error(err);
			return message.channel.send("That channel doesn't exist.")
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		});

	AutoPublish.findById(channel.id, (err, doc) => {
		if (err) {
			return message.channel.send('Something went wrong, try again later')
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}
		if (doc) {
			// eslint-disable-next-line no-param-reassign
			doc.autoPublish = !doc.autoPublish;
			doc.save();
			return message.channel.send(`Auto publishing for <#${channel.id}> is now **${(doc.autoPublish ? 'enabled' : 'disabled')}**`)
				.then((errMsg) => {
					message.delete({ timeout: 4000, reason: 'Automated' });
					errMsg.delete({ timeout: 4000, reason: 'Automated' });
				});
		}
		const publishDoc = new AutoPublish({
			_id: channel.id,
			autoPublish: true,
		});
		publishDoc.save();
		return message.channel.send(`Auto publishing for <#${channel.id}> is now **enabled**`)
			.then((errMsg) => {
				message.delete({ timeout: 4000, reason: 'Automated' });
				errMsg.delete({ timeout: 4000, reason: 'Automated' });
			});
	});
};

exports.config = {
	command: 'autopublish',
};
