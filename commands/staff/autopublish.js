// Imports
// Models
const AutoPublish = require('$/models/publish');

// Local imports
const { logger } = require('$/index');
const config = require('$/config.json');

exports.run = async (client, message, args) => {
	if (!args[0]) return message.channel.send(`**USAGE:** ${config.discord.prefix}autopublish <Discord channel id>`);

	const channel = client.channels.fetch(args[0])
		.catch((err) => {
			logger.error(err);
			return message.channel.send("That channel doesn't exist.");
		});

	AutoPublish.findById(channel.id, (err, doc) => {
		if (err) {
			logger.error(err);
			return message.channel.send('Something went wrong, try again later');
		}

		if (doc) {
			// eslint-disable-next-line no-param-reassign
			doc.autoPublish = !doc.autoPublish;
			doc.save();
			return message.channel.send(`Auto publishing for <#${channel.id}> is now **${(doc.autoPublish ? 'enabled' : 'disabled')}**`);
		}
		const publishDoc = new AutoPublish({
			_id: channel.id,
			autoPublish: true,
		});
		publishDoc.save();
		return message.channel.send(`Auto publishing for <#${channel.id}> is now **enabled**`);
	});
};

exports.config = {
	command: 'autopublish',
};
