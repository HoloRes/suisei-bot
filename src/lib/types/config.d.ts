export interface BaseConfig {
	mode: 'standalone' | 'master' | 'slave';
	discord: {
		token: string;
		id: string;
		secret: string;
	};
	network?: {
		clientId: string;
		token: string;
		url: string;
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
	};
	overrides?: {
		discord?: {
			defaultPrefix?: string;
			developerPrefix?: string;
		};
		[key: string]: any;
	};
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
}

export interface BaseConfigCheck {
	[key: string]: any & Required<BaseConfig>
}

export interface MasterConfig extends BaseConfig {
	mode: 'master';
	network?: never;
	overrides?: never;
}

export interface SlaveConfig extends BaseConfig {
	mode: 'slave';
	network: {
		clientId: string;
		token: string;
		url: string;
	};
	owners?: never;
	db?: never;
	redis?: never;
	api?: never;
	meilisearch?: never;
}

export interface StandAloneConfig extends BaseConfig {
	mode: 'standalone';
	overrides?: never;
}
