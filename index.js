// Imports
const fs = require('fs');
const Discord = require('discord.js');
const mongoose = require('mongoose'); // Library for MongoDB
const express = require('express');
const axios = require('axios');
const path = require('path');
const Sentry = require('@sentry/node');
const winston = require('winston'); // Advanced logging library
const sequence = require('mongoose-sequence');
const moment = require('moment');
const HoloApiClient = require('@holores/holoapi');
const PingSubscription = require('$/models/pingSubscription');
const AutoPublish = require('$/models/publish');
const Mute = require('$/models/activeMute');

// Local config files
const config = require('$/config.json');

// Pre-init
// Winston logger
const date = new Date().toISOString();
const logger = winston.createLogger({
	level: config.logLevel,
	format: winston.format.simple(),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: path.join(__dirname, 'logs', 'error', `${date}.log`), level: 'error' }),
		new winston.transports.File({ filename: path.join(__dirname, 'logs', 'complete', `${date}.log`) }),
	],
});
exports.logger = logger;

// Create a Discord client
const client = new Discord.Client({
	partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER'], // Partials are used to be able to fetch events from non cached items
});
exports.client = client;

// Mongoose sequence
const AutoIncrement = sequence(mongoose);

exports.AutoIncrement = AutoIncrement;

// HoloAPI client
const holoClient = new HoloApiClient();
exports.holoClient = holoClient;

// Local JS files
const youtubeNotifications = require('$/util/youtube');
const twitterNotifications = require('$/util/twitter');
const dashboardRouter = require('$/routers/dashboard');
const moderation = require('$/util/moderation');

// Variables

// Init
// Sentry
if (config.environment === 'production') Sentry.init({ dsn: config.sentryDsn });

// Mongoose
mongoose.connect(`mongodb+srv://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}/${config.mongodb.database}`, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useFindAndModify: false,
});

// Express
const app = express();
app.use('/dash', dashboardRouter);
app.listen(config.expressPort);

// Notifications preparation
if (config.environment === 'production') {
	twitterNotifications.init();
}

// YouTube
youtubeNotifications.init(logger, holoClient, client);

// Moderation
moderation.init();

// Code
// Functions
function loadcmds() {
	// Unload all loaded commands in case it's a reload
	client.commands.forEach((cmd) => {
		client.commands.delete(cmd.config.command);
		delete require.cache[require.resolve(`./commands/user/${cmd.config.command}.js`)];
	});
	client.devcmds.forEach((cmd) => {
		client.devcmds.delete(cmd.config.command);
		delete require.cache[require.resolve(`./commands/dev/${cmd.config.command}.js`)];
	});
	client.staffcmds.forEach((cmd) => {
		client.staffcmds.delete(cmd.config.command);
		delete require.cache[require.resolve(`./commands/staff/${cmd.config.command}.js`)];
	});

	// Fetch all files, filter and load them
	fs.readdir('./commands/user', (err, files) => { // Read all the files in the directory, these are commands available to normal users.
		if (err) throw (err);
		const jsfiles = files.filter((f) => f.split('.').pop() === 'js');
		if (jsfiles.length <= 0) {
			return logger.info('No user commands found.');
		}
		jsfiles.forEach((f) => {
			delete require.cache[require.resolve(`./commands/user/${f}`)];
			// eslint-disable-next-line global-require,import/no-dynamic-require
			const cmd = require(`./commands/user/${f}`);
			client.commands.set(cmd.config.command, cmd);
		});
	});
	fs.readdir('./commands/dev', (err, files) => { // Commands only available to the developer, these can break.
		if (err) throw (err);
		const jsfiles = files.filter((f) => f.split('.').pop() === 'js');
		if (jsfiles.length <= 0) {
			return logger.info('No dev commands found.');
		}
		jsfiles.forEach((f) => {
			delete require.cache[require.resolve(`./commands/dev/${f}`)];
			// eslint-disable-next-line global-require,import/no-dynamic-require
			const cmd = require(`./commands/dev/${f}`);
			client.devcmds.set(cmd.config.command, cmd);
		});
	});
	fs.readdir('./commands/staff', (err, files) => { // Commands only available to the staff
		if (err) throw (err);
		const jsfiles = files.filter((f) => f.split('.').pop() === 'js');
		if (jsfiles.length <= 0) {
			return logger.info('No staff commands found.');
		}
		jsfiles.forEach((f) => {
			delete require.cache[require.resolve(`./commands/staff/${f}`)];
			// eslint-disable-next-line global-require,import/no-dynamic-require
			const cmd = require(`./commands/staff/${f}`);
			client.staffcmds.set(cmd.config.command, cmd);
		});
	});
}

// Discord bot
client.on('ready', () => {
	// These collections hold the commands for the users, developers and staff
	client.commands = new Discord.Collection();
	client.devcmds = new Discord.Collection();
	client.staffcmds = new Discord.Collection();
	loadcmds();
	client.guilds.fetch(config.discord.serverId)
		.then((mainGuild) => mainGuild.members.fetch())
		.catch((e) => logger.error(e));
	logger.info('Bot online');
});

// Ping list reaction handler
client.on('messageReactionAdd', (reaction, user) => {
	if (user.id === client.user.id) return;
	reaction.fetch().then((messageReaction) => {
		PingSubscription.findById(messageReaction.message.id, (err, doc) => {
			if (err) return logger.error(err);
			if (!doc || reaction.emoji.name !== doc.emoji) return;
			const filter = (id) => id === user.id;
			const index = doc.users.findIndex(filter);
			if (index !== -1) return;
			doc.users.push(user.id);
			doc.save();
			logger.debug(`${user.tag} has been added to ${doc.name}`);
		});
	});
});

client.on('messageReactionRemove', (reaction, user) => {
	if (user.id === client.user.id) return;
	reaction.fetch().then((messageReaction) => {
		PingSubscription.findById(messageReaction.message.id, (err, doc) => {
			if (err) return logger.error(err);
			if (!doc || reaction.emoji.name !== doc.emoji) return;
			const filter = (id) => id === user.id;
			const index = doc.users.findIndex(filter);
			if (index === -1) return;
			doc.users.splice(index, 1);
			doc.save();
			logger.debug(`${user.tag} has been removed from ${doc.name}`);
		});
	});
});

// Mute evasion handler
client.on('guildMemberRemove', async (member) => {
	Mute.findOne({ userId: member.id }, (err, doc) => {
		if (err) return logger.error(err);
		if (!doc) return;

		// eslint-disable-next-line no-param-reassign
		doc.leftAt = new Date();
		moderation.unplanMute(doc._id);
		doc.save((e) => {
			if (e) logger.error(e);
		});
	});
});

client.on('guildMemberAdd', async (member) => {
	if (member.partial) await member.fetch();
	const mainGuild = await client.guilds.fetch(config.discord.serverId);
	const clientMember = await mainGuild.members.fetch(client.user.id);

	Mute.findOneAndDelete({ userId: member.id }, (err, doc) => {
		if (err) return logger.error(err);

		if (!doc || !doc.leftAt) return;
		const timeLeftAtLeave = doc.expireAt - doc.leftAt;
		const timeLeft = moment.duration(timeLeftAtLeave, 'ms').asMinutes();
		moderation.mute(member, timeLeft, 'Mute evasion prevention\nAdded strike', clientMember);
	});
});

// Auto publish handler
client.on('message', (message) => {
	AutoPublish.findById(message.channel.id, (err, doc) => {
		if (err) return logger.error(err);
		if (doc) {
			const { options: { http } } = client;
			if (message.channel.type === 'news') {
				axios({
					method: 'POST',
					url: `${http.api}/v${http.version}/channels/${message.channel.id}/messages/${message.id}/crosspost`,
					headers: {
						Authorization: `Bot ${config.discord.token}`,
					},
				})
					.catch(() => {}); // Ignore errors
			} else {
				// eslint-disable-next-line no-param-reassign
				doc.autoPublish = false;
				doc.save();
			}
		}
	});
});

// Message handler
client.on('message', (message) => {
	if (message.author.bot) return;
	if (message.content.startsWith(config.discord.prefix)) { // User command handler
		const cont = message.content.slice(config.discord.prefix.length).split(' ');
		const args = cont.slice(1);

		const staffCmd = client.staffcmds.get(cont[0]);
		if (staffCmd && message.member.hasPermission('MANAGE_GUILD')) return staffCmd.run(client, message, args);
		const cmd = client.commands.get(cont[0]);

		if (cmd) return cmd.run(client, message, args);
	} else if (message.content.startsWith(config.discord.devprefix)) { // Dev command handler
		if (!message.member.roles.cache.has(config.discord.roles.dev)) return;
		const cont = message.content.slice(config.discord.devprefix.length).split(' ');
		if (cont[0] === 'reload') {
			message.channel.send('Reloading commands...');
			loadcmds();
			return message.channel.send('All commands have been reloaded.');
		}
		const args = cont.slice(1);
		const cmd = client.devcmds.get(cont[0]);
		if (cmd) return cmd.run(client, message, args);
	}
});

client.login(config.discord.token);
