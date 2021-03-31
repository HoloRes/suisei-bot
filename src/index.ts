// Imports
import fs from 'fs';
import Discord from 'discord.js';
import mongoose from 'mongoose'; // Library for MongoDB
import Sentry from '@sentry/node';
import winston from 'winston'; // Advanced logging library
import LokiTransport from 'winston-loki';
import Tracing from '@sentry/tracing';

// Types
import { ExtendedClient } from './types';

// Local config files
const config = require('../config.json');

// Pre-init
// Winston logger
const logger = winston.createLogger({
	level: config.logLevel,
	transports: [
		new winston.transports.Console(),
		new LokiTransport({
			host: config.lokiHost,
			labels: { service: 'suisei' },
			level: 'debug',
		}),
	],
});

// Create a Discord client
const client = new Discord.Client({
	partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER'], // Partials are used to be able to fetch events from non cached items
}) as ExtendedClient;
// Variables

// Init
// Sentry
if (config.environment === 'production') {
	Sentry.init({
		dsn: config.sentryDsn,
		release: `suisei-mic@${process.env.COMMIT_SHA}`,
		integrations: [
			new Tracing.Integrations.Mongo(),
			new Sentry.Integrations.Http({ tracing: true }),
		],
		tracesSampleRate: 0.3,
	});
}

// Mongoose
mongoose.connect(`mongodb+srv://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}/${config.mongodb.database}`, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useFindAndModify: false,
});

// Code
// Functions
function loadCommands(): void {
	// Unload all loaded commands in case it's a reload
	client.commands.forEach((cmd) => {
		client.commands.delete(cmd.config.command);
		delete require.cache[require.resolve(`${__dirname}/commands/user/${cmd.config.command}.js`)];
	});
	client.devCommands.forEach((cmd) => {
		client.devCommands.delete(cmd.config.command);
		delete require.cache[require.resolve(`${__dirname}/commands/dev/${cmd.config.command}.js`)];
	});

	// Fetch all files, filter and load them
	fs.readdir(`${__dirname}/commands/user`, (err, files) => { // Read all the files in the directory, these are commands available to normal users.
		if (err) throw err;
		const filteredFiles = files.filter((f) => f.split('.').pop() === 'js' || f.split('.').pop() === 'ts');
		if (filteredFiles.length <= 0) {
			return logger.verbose('No user commands found.', { labels: { module: 'index' } });
		}
		filteredFiles.forEach((f) => {
			delete require.cache[require.resolve(`${__dirname}/commands/user/${f}`)];
			// eslint-disable-next-line global-require,import/no-dynamic-require
			const cmd = require(`${__dirname}/commands/user/${f}`);
			client.commands.set(cmd.config.command, cmd);
		});
	});
	fs.readdir(`${__dirname}/commands/dev`, (err, files) => { // Commands only available to the developer, these can break.
		if (err) throw err;
		const filteredFiles = files.filter((f) => f.split('.').pop() === 'js' || f.split('.').pop() === 'ts');
		if (filteredFiles.length <= 0) {
			return logger.verbose('No dev commands found.', { labels: { module: 'index' } });
		}
		filteredFiles.forEach((f) => {
			delete require.cache[require.resolve(`${__dirname}/commands/dev/${f}`)];
			// eslint-disable-next-line global-require,import/no-dynamic-require
			const cmd = require(`${__dirname}/commands/dev/${f}`);
			client.devCommands.set(cmd.config.command, cmd);
		});
	});
}

// Discord bot
client.on('ready', () => {
	// These collections hold the commands for the users, developers and staff
	client.commands = new Discord.Collection();
	client.devCommands = new Discord.Collection();
	loadCommands();
	logger.info(`Bot online, version: ${process.env.COMMIT_SHA?.substring(0, 10)}`, { labels: { module: 'index' } });
});

// Message handler
client.on('message', (message) => {
	if (message.author.bot) return;
	if (message.content.startsWith(config.discord.prefix)) { // User command handler
		const cont = message.content.slice(config.discord.prefix.length).split(' ');
		const args = cont.slice(1).join(' ').trim().split(' ');

		const cmd = client.commands.get(cont[0]);
		if (cmd) return cmd.run(client, message, args);
	} else if (message.content.startsWith(config.discord.devprefix)) { // Dev command handler
		if (!message.member?.roles.cache.has(config.discord.roles.dev)) return;

		const cont = message.content.slice(config.discord.devprefix.length).split(' ');

		if (cont[0] === 'reload') {
			message.channel.send('Reloading commands...');
			loadCommands();
			return message.channel.send('All commands have been reloaded.');
		}

		const args = cont.slice(1).join(' ').trim().split(' ');
		const cmd = client.devCommands.get(cont[0]);
		if (cmd) return cmd.run(client, message, args);
	}
});

client.login(config.discord.token);
