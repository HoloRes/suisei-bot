import type { LogLevel } from '@sapphire/framework';
import * as typia from 'typia';
import type { TypeGuardError } from 'typia';

const assertConfig = typia.createAssert<Config>();

export function checkConfig(config: unknown): config is Config {
	try {
		assertConfig(config);
		return true;
	} catch (err: unknown) {
		if (err) {
			console.error(`${(err as TypeGuardError).name}: ${(err as TypeGuardError).message}`);
		}
		return false;
	}
}

export default interface Config {
	discord: {
		token: string;
		id: string;
		secret: string;
	};
	config: {
		environmentId: string;
		api?: string;
	};
	db: {
		username: string;
		password: string;
		database: string;
		host: string;
		protocol: string;
		query?: string;
	};
	redis: {
		password?: string;
		host: string;
		port?: number;
		db?: number;
	};
	meilisearch: {
		host: string;
		key: string;
	};
	owners: string[];
	api: {
		port: number;
		baseUrl: string;
		origin?: string;
		adminKey: string;
	};
	overrides?: {
		discord?: {
			defaultPrefix?: string;
			developerPrefix?: string;
		};
		[key: string]: any;
	};
	logLevel?: LogLevel;
	logTransports?: {
		console?: {
			level?: 'debug' | 'verbose' | 'info' | 'warn' | 'error';
		};
		loki?: {
			host: string;
			level?: 'debug' | 'verbose' | 'info' | 'warn' | 'error';
		};
		file?: {
			level?: 'debug' | 'verbose' | 'info' | 'warn' | 'error';
		};
	};
	holodex: {
		apikey: string;
	};
	bansApi: {
		keyId: string;
		apiKey: string;
		endpoint?: string;
		rabbitmqEndpoint?: string;
	};
	twitter: {
		managementGuilds: string[];
	}
	sentry?: {
		dsn: string;
	};
// eslint-disable-next-line
}
