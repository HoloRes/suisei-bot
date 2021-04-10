// Packages
import { assertEquals } from 'typescript-is';
import winston from 'winston';
import LokiTransport from 'winston-loki';
import process from 'process';
import express from 'express';
import * as Sentry from '@sentry/node';
import * as SentryTracing from '@sentry/tracing';
import * as path from 'path';
import mongoose from 'mongoose';
import Discord from 'discord.js';

// Types
import { IConfig } from './types';
import {
	StandAloneConfig,
	SlaveConfig,
	MasterConfig,
	DeveloperRole,
	DeveloperUser,
} from './types/config';

// Modules
import MainModule from './modules/main';
import AutoPublishModule from './modules/AutoPublish';
import DevModule from './modules/dev';
import UtilityModule from './modules/util';

// Local files
const config: IConfig = require('../config');

// Init
const myFormat = winston.format.printf(({
	level, message, label, timestamp,
}) => `${timestamp} ${label ? `[${label}]` : ''} ${level}: ${message}`);

export const logger = winston.createLogger({
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

// Config validation
try {
	assertEquals<IConfig>(config);
	if (config.mode === 'master') {
		assertEquals<MasterConfig>(config);
	} else if (config.mode === 'slave') {
		assertEquals<SlaveConfig>(config);
	} else if (config.mode === 'standalone') {
		assertEquals<StandAloneConfig>(config);
	}

	if (config.developer.type === 'user') {
		assertEquals<DeveloperUser>(config.developer);
	} else if (config.developer.type === 'role') {
		assertEquals<DeveloperRole>(config.developer);
	}
} catch (e) {
	logger.error(`${e.name}: ${e.message}`);
	logger.verbose('Invalid config, quiting');
	process.exit(1);
}

logger.debug('Config validated. Initializing.');
if (config.logTransports?.loki) {
	logger.add(new LokiTransport({
		host: config.logTransports.loki.host,
		level: config.logTransports.loki.level ?? 'info',
		labels: { service: 'suisei' },
	}));
	logger.debug('Added Loki transport');
}
if (config.logTransports?.file) {
	const date = new Date();
	logger.add(new winston.transports.File({
		filename: path.join(__dirname, '../logs', `${date}.log`),
		level: config.logTransports.file.level ?? 'info',
	}));
}

const app = config.api ? express() : undefined;
app?.listen(config.api?.port);

if (config.sentry) {
	const integrations = [];

	if (config.api) {
		integrations.push(new Sentry.Integrations.Http({ tracing: true }));
		integrations.push(new SentryTracing.Integrations.Express({ app }));
	}

	Sentry.init({
		dsn: config.sentry.dsn,
		tracesSampleRate: 0.5,
		integrations,
	});

	app?.use(Sentry.Handlers.requestHandler() as express.RequestHandler);
	app?.use(Sentry.Handlers.tracingHandler());
	app?.use(Sentry.Handlers.errorHandler() as express.ErrorRequestHandler);
}

if (config.mongodb) {
	mongoose.connect(`${config.mongodb.protocol}://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}/${config.mongodb.database}`, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
	});
} else if (config.overrides?.mongodb) {
	mongoose.connect(`${config.overrides.mongodb.protocol}://${config.overrides.mongodb.username}:${config.overrides.mongodb.password}@${config.overrides.mongodb.host}/${config.overrides.mongodb.database}`, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
	});
}

export const client = new Discord.Client();

client.on('ready', () => {
	logger.info(`Started, running version ${process.env.COMMIT_SHA ?? 'unknown'}`);

	MainModule.start(client);
	if (config.modules.developer) DevModule.start(client);
	if (config.modules.utility) UtilityModule.start(client);
	if (config.modules.autoPublish) AutoPublishModule.start(client);
});

client.login(config.discord.token);
