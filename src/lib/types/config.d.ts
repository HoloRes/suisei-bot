import { LogLevel } from '@sapphire/framework';

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
	holodex?: {
		apikey: string;
	};
	sentry?: {
		dsn: string;
	};
// eslint-disable-next-line
}
