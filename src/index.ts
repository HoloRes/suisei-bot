// Packages
import 'reflect-metadata';
import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-api/register';
import '@sapphire/plugin-scheduled-tasks/register';

import process from 'process';
import * as Sentry from '@sentry/node';
import { getRootData } from '@sapphire/pieces';
import { join } from 'node:path';
import { GatewayIntentBits, Partials } from 'discord.js';
import { container, LogLevel } from '@sapphire/framework';
import * as promClient from 'prom-client';
import express from 'express';
import { SuiseiClient } from '#src/lib/SuiseiClient';
import { checkConfig } from '#src/lib/types/config';

// Types
import type Config from '#src/lib/types/config';

// Local files
// eslint-disable-next-line import-x/extensions
const config: unknown = require('../config.js');

// Config validation
if (!checkConfig(config)) {
	console.error('Invalid config, quiting');
	process.exit(1);
}
console.log('Config validated. Initializing...');
// Set config in the Saphire container
container.config = config;

// Enable Sentry if needed
if (config.sentry) {
	Sentry.init({
		dsn: config.sentry.dsn,
		integrations: [
			Sentry.modulesIntegration(),
			Sentry.httpIntegration({ breadcrumbs: true }),
			Sentry.rewriteFramesIntegration({ root: join(getRootData().root, '..') }),
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
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
	],
	defaultPrefix: config.overrides?.discord?.defaultPrefix ?? '!',
	loadMessageCommandListeners: true,
	logger: {
		level: config.logLevel ?? process.env.NODE_ENV !== 'production' ? LogLevel.Debug : LogLevel.Info,
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
				port: config.redis?.port,
				password: config.redis?.password,
				db: config.redis?.db,
			},
		},
	},
});

async function main() {
	await client.login((config as Config).discord.token);
}

main().catch(container.logger.error.bind(container.logger));
