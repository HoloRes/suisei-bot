// Packages
import { assertEquals } from 'typescript-is';
import process from 'process';
import * as Sentry from '@sentry/node';
import { RewriteFrames } from '@sentry/integrations';
import { getRootData } from '@sapphire/pieces';
import { join } from 'node:path';
import { Intents } from 'discord.js';
import { ModuleLoader } from '@suiseis-mic/sapphire-modules';
import '@sapphire/plugin-api/register';
import 'reflect-metadata';
import { container } from '@sapphire/framework';
import winston from 'winston';
import LokiTransport from 'winston-loki';
import flagsmith from 'flagsmith-nodejs';
import { SuiseiClient } from './lib/SuiseiClient';

// Types
import type {
	BaseConfigCheck,
	MasterConfig,
	SlaveConfig,
	StandAloneConfig,
} from './lib/types/config';

// Local files
// eslint-disable-next-line import/extensions,global-require
const config: MasterConfig | SlaveConfig | StandAloneConfig = require('../config.js');

// Init
const myFormat = winston.format.printf(({
	level, message, label, timestamp,
}) => `${timestamp} ${label ? `[${label}]` : ''} ${level}: ${message}`);

const logger = winston.createLogger({
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.cli(),
				myFormat,
			),
			level: config.logTransports?.console?.level ?? 'info',
		}),
	],
});
// @ts-expect-error not compatible types
container.logger = logger;

// Config validation
try {
	assertEquals<BaseConfigCheck>(config);
	if (config.mode === 'master') {
		assertEquals<MasterConfig>(config);
	} else if (config.mode === 'slave') {
		assertEquals<SlaveConfig>(config);
	} else if (config.mode === 'standalone') {
		assertEquals<StandAloneConfig>(config);
	}
} catch (err: any) {
	if (err) logger.error(`${err.name}: ${err.message}`);
	logger.error('Invalid config, quiting');
	process.exit(1);
}

logger.debug('Config validated. Initializing.');
container.config = config;
if (config.logTransports?.loki) {
	logger.add(new LokiTransport({
		host: config.logTransports.loki.host,
		level: config.logTransports.loki.level ?? 'info',
		labels: { service: 'suisei' },
	}));
	logger.debug('Added Loki transport');
}
if (config.logTransports?.file) {
	const date = new Date().toISOString();
	logger.add(new winston.transports.File({
		filename: join(__dirname, '../logs', `${date}.log`),
		level: config.logTransports.file.level ?? 'info',
	}));
	logger.debug('Added File transport');
}

flagsmith.init({
	api: config.config.api,
	environmentID: config.config.environmentId,
});

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

// TODO: Move client init to function, split up this file
const client = new SuiseiClient({
	partials: ['CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION'],
	intents: [
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_BANS,
		Intents.FLAGS.GUILDS,
	],
	defaultPrefix: config.overrides?.discord?.defaultPrefix ?? '!',
	loadMessageCommandListeners: true,
});

// TODO: Get from Flagsmith
ModuleLoader.init({});

client.once('ready', () => {
	logger.info(`Started, running version ${process.env.COMMIT_SHA ?? 'unknown'}`);
});

client.login(config.discord.token);
