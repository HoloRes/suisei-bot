// Imports
const { scheduleJob } = require('node-schedule');
const { MessageEmbed } = require('discord.js');

// Models
const Subscription = require('$/models/subscription');
const Livestream = require('$/models/stream');

async function fetchLivestreams(logger, holoClient, client) {
	const { live, upcoming } = await holoClient.videos.getLivestreams(undefined, 72, 0, true);

	const updatedChannels = [];

	// noinspection ES6MissingAwait
	live.forEach(async (ls) => {
		const sub = await Subscription.findById(ls.channel.youtubeId).exec()
			.catch((err) => logger.error(err));
		if (!sub) return;

		// noinspection ES6MissingAwait
		sub.channels.forEach(async (ch) => {
			const channel = await client.channels.fetch(ch.id);
			if (updatedChannels.findIndex((id) => id === channel.id) === -1) {
				channel.setTopic(`Currently live: ${live.length} | Planned livestreams in next 3 days: ${upcoming.length}`);
				updatedChannels.push(channel.id);
			}
			const hooks = await channel.fetchWebhooks();
			const webhook = hooks.find((wh) => wh.name.toLowerCase() === 'stream notification');

			const embed = new MessageEmbed()
				.setTitle(ls.title)
				.setURL(`https://youtu.be/${ls.youtubeId}`)
				.setImage(`https://i.ytimg.com/vi/${ls.youtubeId}/maxresdefault.jpg`)
				.setColor('#FF0000')
				.setFooter("Powered by Suisei's mic");

			const stream = await Livestream.findById(ls.youtubeId).catch((err) => logger.error(err));
			if (stream) {
				/*
				 * TODO: Need to wait for: https://github.com/discordjs/discord.js/pull/5223
				 *  This will allow editing of webhook messages in case the title changes
				 */
				return;
			}
			const msg = await webhook.send(ch.message, {
				embeds: [embed],
				username: ls.channel.username,
				avatarURL: ls.channel.photo,
			});
			const livestream = new Livestream({
				_id: ls.youtubeId,
				title: ls.title,
				messageId: msg.id,
			});
			livestream.save();
		});
	});
}

exports.init = (logger, holoClient, client) => {
	fetchLivestreams(logger, holoClient, client);
	scheduleJob('* * * * *', () => fetchLivestreams(logger, holoClient, client));
};
