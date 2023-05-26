// Packages
import 'reflect-metadata';
import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-api/register';

// import { assert } from 'typia';
import process from 'process';
import * as Sentry from '@sentry/node';
import { RewriteFrames } from '@sentry/integrations';
import { getRootData } from '@sapphire/pieces';
import { join } from 'node:path';
import { ChannelType, GatewayIntentBits, Partials } from 'discord.js';
import { ApplicationCommandRegistries, container, LogLevel } from '@sapphire/framework';
import * as promClient from 'prom-client';
import express from 'express';
import { SuiseiClient } from './lib/SuiseiClient';

// Types
import type {
	// BaseConfigCheck,
	MasterConfig,
	SlaveConfig,
	StandAloneConfig,
} from './lib/types/config';

// Local files
// eslint-disable-next-line import/extensions,global-require
const config: MasterConfig | SlaveConfig | StandAloneConfig = require('../config.js');

// Config validation
/* try {
	assert<BaseConfigCheck>(config);
	if (config.mode === 'master') {
		assert<MasterConfig>(config);
	} else if (config.mode === 'slave') {
		assert<SlaveConfig>(config);
	} else if (config.mode === 'standalone') {
		assert<StandAloneConfig>(config);
	}
} catch (err: any) {
	if (err) container.logger.error(`${err.name}: ${err.message}`);
	// eslint-disable-next-line no-console
	console.error('Invalid config, quiting');
	process.exit(1);
} */

// eslint-disable-next-line no-console
console.info('Config validated. Initializing.');
// Set config in the Saphire container
container.config = config;

// Enable Flagsmith
/* const flagsmith = new Flagsmith({
	api: config.config.api ?? 'https://config.suisei.app',
	environmentKey: config.config.environmentId,
});
container.remoteConfig = flagsmith; */

// Enable Sentry if needed
if (config.sentry) {
	Sentry.init({
		dsn: config.sentry.dsn,
		integrations: [
			new Sentry.Integrations.Modules(),
			new Sentry.Integrations.Http({ breadcrumbs: true, tracing: true }),
			new RewriteFrames({ root: join(getRootData().root, '..') }),
		],
	});
}

// Enable Prometheus metrics
const app = express();

promClient.collectDefaultMetrics();
container.counters = {
	youtube: {
		total: new promClient.Counter({
			name: 'suisei_mic_youtube_notification_total_count',
			help: 'Amount of YouTube notifications received from Holodex',
		}),
		success: new promClient.Counter({
			name: 'suisei_mic_youtube_notification_success_count',
			help: 'Amount of YouTube notifications successfully processed',
		}),
	},
};

app.get('/metrics', async (req, res) => {
	try {
		res.set('Content-Type', promClient.register.contentType);
		res.end(await promClient.register.metrics());
	} catch (ex) {
		res.status(500).end(ex);
	}
});

app.listen(5000);

// Client init logic
const client = new SuiseiClient({
	partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction],
	intents: [
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildBans,
		GatewayIntentBits.Guilds,
	],
	defaultPrefix: config.overrides?.discord?.defaultPrefix ?? '!',
	loadMessageCommandListeners: true,
	logger: {
		level: process.env.NODE_ENV !== 'production' ? LogLevel.Debug : LogLevel.Info,
	},
	api: {
		listenOptions: {
			port: config.api?.port,
		},
	},
	tasks: {
		bull: {
			connection: {
				host: config.redis?.host,
			},
		},
	},
});

async function main() {
	await client.login(config.discord.token);

	// Register commands
	// This needs to be done outside, since there's no override available for the Subcommand class
	const configRegistry = ApplicationCommandRegistries.acquire('config');
	configRegistry.registerChatInputCommand((builder) => {
		builder
			.setName('config')
			.setDescription('Manage guild config')
			.addSubcommand((command) => command
				.setName('set')
				.setDescription('Set a config option')
				.addStringOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('key')
					.setDescription('Config key to set')
					.setAutocomplete(true))
				.addStringOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('value')
					.setDescription('Value to set it to')))
			.addSubcommand((command) => command
				.setName('get')
				.setDescription('Get a config value')
				.addStringOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('key')
					.setDescription('Config key to get')
					.setAutocomplete(true)));
	});

	// YouTube subscriptions
	const subscriptionsRegistry = ApplicationCommandRegistries.acquire('subscriptions');
	subscriptionsRegistry.registerChatInputCommand((builder) => {
		builder
			.setName('subscriptions')
			.setDescription('Manage YouTube notification subscriptions')
			.addSubcommand((command) => command
				.setName('add')
				.setDescription('Add a subscription')
				.addStringOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('vtuber')
					.setDescription('VTuber to send notifications for')
					.setAutocomplete(true))
				.addChannelOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('channel')
					.setDescription('Channel to send notifications in')
					.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText))
				.addStringOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('message')
					.setDescription('Message to include in the notification')))
			.addSubcommand((command) => command
				.setName('setquery')
				.setDescription('Set a query for notifications')
				.addStringOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('query')
					.setDescription('Query to filter for e.g. "org:hololive -org:nijisanji" (see docs)'))
				.addChannelOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('channel')
					.setDescription('Channel to send notifications in')
					.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText))
				.addStringOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('message')
					.setDescription('Message to include in the notification, can use parameters like {name} or {org} (see docs)')))
			.addSubcommand((command) => command
				.setName('remove')
				.setDescription('Remove a subscription')
				.addStringOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('vtuber')
					.setDescription('VTuber to send notifications for')
					.setAutocomplete(true))
				.addChannelOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('channel')
					.setDescription('Channel to send notifications in')
					.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)))
			.addSubcommand((command) => command
				.setName('list')
				.setDescription('List all subscriptions')
				.addChannelOption((optBuilder) => optBuilder
					.setRequired(true)
					.setName('channel')
					.setDescription('Channel to send notifications in')
					.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)));
	});
}

main().catch(container.logger.error.bind(container.logger));
