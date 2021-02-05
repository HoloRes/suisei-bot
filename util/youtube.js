// Imports
// Models

// Packages
const Discord = require('discord.js');
const xml2js = require('xml2js');
const express = require('express');
const axios = require('axios');
const { createHmac } = require('crypto');
const { scheduleJob } = require('node-schedule');
const rawBody = require('raw-body');
const querystring = require('querystring');
const { google } = require('googleapis');
const puppeteer = require('puppeteer'); // Headless Chromium browser
const Livestream = require('$/models/stream');
const Subscription = require('$/models/subscription');

// Local imports
const { logger, client } = require('$/index');
const config = require('$/config.json');

// Variables

// This array will hold all streams that have been scheduled with node-schedule during this run
const scheduledStreams = [];

const puppeteerOptions = {
	args: ['--disable-dev-shm-usage', '--no-sandbox'],
};

// Init
const videoRegex = /\/watch\?v=.{11}/g;
// Google YT Data V3 API
const YT = google.youtube('v3');

// Express
const router = express.Router();

// Functions
async function parseBody(req, res, next) {
	try {
		const xhs = req.headers['x-hub-signature'] || req.headers['X-Hub-Signature'];
		// await logger.debug(`Original sign: ${xhs}`);
		const method = xhs.split('=')[0];
		const csign = await createHmac(method, config.PubSubHubBub.secret);
		const raw = await rawBody(req);
		await csign.update(raw);
		req.body = await xml2js.parseStringPromise(raw);
		req.body.verified = xhs === `${method}=${csign.digest('hex')}`;
		// await logger.debug(`Created sign: ${method}=${csign.digest("hex")}`);
		next();
	} catch (error) {
		next(error);
	}
}

function checkLive(feed, subscription) {
	logger.debug(`checkLive called for: ${feed.entry[0]['yt:videoId'][0]}`);
	logger.debug(JSON.stringify(feed, null, 4));
	logger.debug(JSON.stringify(subscription, null, 4));
	const removedChannels = [];
	YT.videos.list({
		auth: config.YtApiKey,
		id: feed.entry[0]['yt:videoId'][0],
		part: 'snippet,liveStreamingDetails',
	}, (err, video) => {
		if (err) return logger.error(err);
		if (!video || video.data.items.length === 0) return logger.verbose('Video not found');
		logger.debug('-----------------------------------------');
		logger.debug(JSON.stringify(video, null, 4));
		logger.debug('-----------------------------------------');
		if (video.data.items[0].snippet.liveBroadcastContent !== 'live') {
			return Livestream.findById(feed.entry[0]['yt:videoId'][0], (err2, stream) => {
				if (err2) return logger.error(err2);
				if (stream.retry < 6) {
					setTimeout(() => {
						checkLive(feed, subscription);
					}, 5 * 60 * 1000);
					// eslint-disable-next-line no-param-reassign
					stream.retry += 1;
					return stream.save();
				}
				Livestream.remove({ _id: stream._id });
				return logger.debug('Not a live broadcast.');
			});
		}
		YT.channels.list({
			auth: config.YtApiKey,
			id: video.data.items[0].snippet.channelId,
			part: 'snippet',
		}, (err2, ytChannel) => {
			if (err2) return logger.error(err2);
			// eslint-disable-next-line no-plusplus
			for (let i = 0; i < subscription.channels.length; i++) {
				client.channels.fetch(subscription.channels[i].id)
					.then((channel) => {
						channel.fetchWebhooks()
							.then((hooks) => {
								logger.debug('Trying to find webhook');
								const webhook = hooks.find((wh) => wh.name.toLowerCase() === 'stream notification');
								if (!webhook) return removedChannels.push(i);
								const embed = new Discord.MessageEmbed()
									.setTitle(feed.entry[0].title[0])
									.setURL(feed.entry[0].link[0].$.href)
									.setImage(video.data.items[0].snippet.thumbnails.maxres.url)
									.setColor('#FF0000')
									.setFooter("Powered by Suisei's Mic");

								logger.debug('Trying to send message');
								webhook.send(subscription.channels[i].message, {
									embeds: [embed],
									username: ytChannel.data.items[0].snippet.title,
									avatarURL: ytChannel.data.items[0].snippet.thumbnails.high.url,
								}).then((msg) => {
									Livestream.findByIdAndUpdate(feed.entry[0]['yt:videoId'][0], { messageID: msg.id }, (err3) => {
										if (err3) logger.error(err3);
									});
								});
							});
					})
					.catch((err3) => {
						logger.error(err3);
						if (err3) removedChannels.push(i);
					});
			}
			// eslint-disable-next-line no-plusplus
			for (let i = 0; i < removedChannels.length; i++) {
				subscription.channels.splice(subscription.channels.findIndex(removedChannels[i]), 1);
			}
		});
	});
}

// Exports
exports.planLivestreams = async (channelID) => {
	const browser = await puppeteer.launch(puppeteerOptions);
	const page = await browser.newPage();

	await page.goto(`https://www.youtube.com/channel/${channelID}/videos?view=2&live_view=502&flow=grid`);
	const content = await page.content();

	const matches = await content.match(/Upcoming live streams/g);
	const isPlannedStreamPage = matches !== null && matches.length > 0;

	if (!isPlannedStreamPage) return browser.close();

	const rawStreams = await content.match(videoRegex);
	const streams = [];
	const streamIDs = [];

	// eslint-disable-next-line no-plusplus
	for (let i = 0; i < rawStreams.length; i++) {
		// eslint-disable-next-line no-await-in-loop
		const videoID = await rawStreams[i].substring('/watch?v='.length);
		const index = streamIDs.findIndex((id) => id === videoID);
		if (index === -1) streamIDs.push(videoID);
	}

	// eslint-disable-next-line no-plusplus
	for (let i = 0; i < streamIDs.length; i++) {
		// eslint-disable-next-line no-await-in-loop
		await Livestream.findById(streamIDs[i]).lean().exec((err2, doc) => {
			if (err2) return logger.error(err2);
			if (!doc) {
				YT.videos.list({
					auth: config.YtApiKey,
					id: streamIDs[i],
					part: 'snippet,liveStreamingDetails',
				}, (err3, video) => {
					if (err3) return logger.verbose(err3);
					if (video.data.items[0].snippet.liveBroadcastContent !== 'upcoming') return;
					streams.push({
						id: streamIDs[i],
						plannedDate: video.data.items[0].liveStreamingDetails.scheduledStartTime,
						title: video.data.items[0].snippet.title,
					});
					const stream = new Livestream({
						_id: streamIDs[i],
						plannedDate: video.data.items[0].liveStreamingDetails.scheduledStartTime,
						title: video.data.items[0].snippet.title,
						ytChannelID: channelID,
					});
					stream.save();
				});
			}
		});
	}
	await browser.close();

	// eslint-disable-next-line no-plusplus
	for (let i = 0; i < streams.length; i++) {
		const plannedDate = new Date(streams[i].plannedDate);
		// eslint-disable-next-line no-await-in-loop
		await Subscription.findById(channelID).lean().exec((err3, subscription) => {
			const feed = { // Recreating the PubSubHubBub feed as the function is coded to use this
				entry: [
					{
						'yt:videoId': [streams[i].id],
						'yt:channelId': [channelID],
						title: [streams[i].title],
						link: [
							{
								$: {
									href: `https://www.youtube.com/watch?v=${streams[i]._id}`,
								},
							},
						],
					},
				],
			};
			scheduleJob(plannedDate, () => {
				setTimeout(() => {
					logger.debug(`Running for: ${streams[i]._id}`);
					checkLive(feed, subscription);
				}, 5 * 60 * 1000);
			});
			scheduledStreams.push(streams[i]._id);
		});
	}
};

exports.init = () => {
	// Get all planned livestreams from subscriptions and add them to schedule.
	Subscription.find({}).lean().exec(async (err, subscriptions) => {
		if (err) throw new Error("Couldn't read subscriptions");

		await Livestream.deleteMany({}, (err2) => {
			if (err2) logger.error('Failed to remove all existing planned livestreams from the database.');
		});

		const browser = await puppeteer.launch(puppeteerOptions);
		const page = await browser.newPage();

		/* eslint-disable no-await-in-loop */
		// eslint-disable-next-line no-plusplus
		for (let i = 0; i < subscriptions.length; i++) {
			await page.goto(`https://www.youtube.com/channel/${subscriptions[i]._id}/videos?view=2&live_view=502&flow=grid`);
			const ytChannelID = subscriptions[i]._id;
			const content = await page.content();

			const matches = await content.match(/Upcoming live streams/g);
			const isPlannedStreamPage = matches !== null && matches.length > 0;

			if (isPlannedStreamPage) {
				const rawStreams = await content.match(videoRegex);
				const streams = [];

				// eslint-disable-next-line no-plusplus
				for (let x = 0; i < rawStreams.length; x++) {
					const videoID = await rawStreams[i].substring('/watch?v='.length);
					const index = streams.findIndex((id) => id === videoID);
					if (index === -1) streams.push(videoID);
				}

				// eslint-disable-next-line no-plusplus
				for (let x = 0; i < streams.length; x++) {
					await Livestream.exists({ _id: streams[i] }, (err2, doc) => {
						if (err2) return logger.error(err2);
						if (!doc) {
							YT.videos.list({
								auth: config.YtApiKey,
								id: streams[i],
								part: 'snippet,liveStreamingDetails',
							}, (err3, video) => {
								if (err3) return logger.verbose(err3);
								if (video.data.items[0].snippet.liveBroadcastContent !== 'upcoming') return;
								const stream = new Livestream({
									_id: streams[i],
									plannedDate: video.data.items[0].liveStreamingDetails.scheduledStartTime,
									title: video.data.items[0].snippet.title,
									ytChannelID,
								});
								stream.save((err4) => {
									if (err4) logger.error(err4);
								});
							});
						}
					});
				}
			}
		}
		/* eslint-enable no-await-in-loop */

		await Livestream.find({}).lean().exec((err2, livestreams) => {
			if (err2) return logger.error(err2);
			// eslint-disable-next-line no-plusplus
			for (let i = 0; i < livestreams.length; i++) {
				logger.debug(JSON.stringify(livestreams[i], null, 4));
				const plannedDate = new Date(livestreams[i].plannedDate);
				Subscription.findById(livestreams[i].ytChannelID).lean().exec((err3, subscription) => {
					const feed = { // Recreating the PubSubHubBub feed as the function is coded to use this
						entry: [
							{
								'yt:videoId': [livestreams[i]._id],
								'yt:channelId': [livestreams[i].ytChannelID],
								title: [livestreams[i].title],
								link: [
									{
										$: {
											href: `https://www.youtube.com/watch?v=${livestreams[i]._id}`,
										},
									},
								],
							},
						],
					};
					scheduleJob(plannedDate, () => {
						logger.debug(`Running for: ${livestreams[i]._id}`);
						checkLive(feed, subscription);
					});
					scheduledStreams.push(livestreams[i]._id);
					logger.debug(scheduledStreams);
				});
			}
		});

		await browser.close();
	});

	// Add all subscriptions
	scheduleJob('0 * * * *', () => { // Resubscribe every hour
		Subscription.find({}).lean().exec((err, docs) => {
			if (err) throw new Error("Couldn't read subscriptions");
			// eslint-disable-next-line no-plusplus
			for (let i = 0; i < docs.length; i++) {
				try {
					axios({
						url: 'http://pubsubhubbub.appspot.com/',
						method: 'POST',
						headers: { 'content-type': 'application/x-www-form-urlencoded' },
						data: querystring.stringify({
							'hub.mode': 'subscribe',
							'hub.callback': `${config.PubSubHubBub.callbackUrl}/yt/push/${docs[i]._id}`,
							'hub.topic': `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${docs[i]._id}`,
							'hub.lease_seconds': `${60 * 60}`, // 1 hour lease
							'hub.secret': config.PubSubHubBub.secret,
						}),
					}).then((res) => {
						if (res.status === 202) logger.verbose(`Subscription to ${docs[i]._id} successful.`);
						else logger.verbose(`Subscription to ${docs[i]._id} gave response: ${res.status}`);
					}).catch((err2) => {
						if (err2) logger.warn(`Error: ${err2.response.status}, subscription to ${docs[i]._id} unsuccessful.`);
					});
				} catch (err2) {
					if (err2) return logger.warn(`Couldn't subscribe to channel: ${docs[i]._id}`);
				}
			}
		});
	});
};

// Code
// Router
router.get('/push/:id', (req, res) => { // PubSubHubBub notifications
	logger.debug(req.query['hub.challenge']);
	if (req.query['hub.challenge'].length > 0) {
		logger.verbose(`Responding with challenge code for channel: ${req.params.id}`);
		res.status(200).send(req.query['hub.challenge']);
		logger.debug('-----------------------------------------');
	} else res.status(400).send('');
});

router.post('/push/:id', parseBody, (req, res) => {
	if (!req.body.verified) return res.status(403).send('');
	logger.debug('-----------------------------------------');
	logger.debug(JSON.stringify(req.body.feed, null, 4));
	logger.debug('-----------------------------------------');
	res.status(200).send('');
	if (req.body.feed['at:deleted-entry']) return; // This means a stream/video got set to private or was deleted
	Livestream.exists({ _id: req.body.feed.entry[0]['yt:videoId'][0] }, (err, doc) => {
		if (err) return logger.error(err);
		if (!doc) {
			logger.debug(`Document doesn't exist for: ${req.body.feed.entry[0]['yt:videoId'][0]}`);
			Subscription.findById(req.body.feed.entry[0]['yt:channelId'][0], (err2, subscription) => {
				if (err2) return logger.error(err2);
				YT.videos.list({
					auth: config.YtApiKey,
					id: req.body.feed.entry[0]['yt:videoId'][0],
					part: 'snippet,liveStreamingDetails',
				}, (err3, video) => {
					if (err3) return logger.error(err3);
					logger.debug(JSON.stringify(video.data, null, 4));
					if (video.data.items[0].snippet.liveBroadcastContent === 'none') return;
					if (video.data.items[0].snippet.liveBroadcastContent === 'live') {
						logger.debug('Checking stream (live status)');
						return checkLive(req.body.feed, subscription);
					}
					logger.debug(`Upcoming: ${video.data.items[0].snippet.liveBroadcastContent}`);
					const stream = new Livestream({
						_id: req.body.feed.entry[0]['yt:videoId'][0],
						plannedDate: video.data.items[0].liveStreamingDetails.scheduledStartTime,
						title: video.data.items[0].snippet.title,
					});
					stream.save((err4) => {
						if (err3) logger.error(err4);
					});
					const currentDate = new Date();
					const plannedDate = new Date(video.data.items[0].liveStreamingDetails.scheduledStartTime);
					// Calculate ime difference between current in minutes
					const diffTime = Math.ceil(Math.abs(plannedDate - currentDate) / 1000 / 60);

					logger.debug(`Current date: ${currentDate.toISOString()}`);
					logger.debug(`Planned date: ${plannedDate.toISOString()}`);
					logger.debug(`Diff time: ${diffTime}`);

					if (diffTime < 10 || plannedDate <= currentDate) {
						logger.debug('Plan check stream (diffTime < 10)');
						setTimeout(() => {
							checkLive(req.body.feed, subscription);
						}, 5 * 60 * 1000);
					} else if (diffTime >= 10) {
						logger.debug('Plan check stream (diffTime >= 10)');
						scheduleJob(plannedDate, () => {
							logger.debug(`Running for: ${req.body.feed.entry[0]['yt:videoId'][0]}`);
							checkLive(req.body.feed, subscription);
						});
						scheduledStreams.push(req.body.feed.entry[0]['yt:videoId'][0]);
					}
				});
			});
		}
	});
});

exports.router = router;
