// Packages
import { assertEquals } from 'typescript-is';
import winston from 'winston';
import process from 'process';

// Local files
import { Config as ConfigType } from './types';
import {
	StandAloneConfig,
	SlaveConfig,
	MasterConfig,
	DeveloperRole,
	DeveloperUser,
} from './types/config';

const config: ConfigType = require('../config');

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

// Config validation
try {
	assertEquals<ConfigType>(config);
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
