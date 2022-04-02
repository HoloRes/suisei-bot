import { IModulesConfig } from "@suiseis-mic/sapphire-modules";

interface BaseConfig {
	mode: 'standalone' | 'master' | 'slave',
	modules: IModulesConfig,
	discord: {
		token: string,
		defaultPrefix?: string,
		developerPrefix?: string,
	},
	twitter?: {
		consumerKey: string,
		consumerSecret: string,
		accessTokenKey: string,
		accessTokenSecret: string,
	},
	developer: {
		type: 'user' | 'role',
		userId?: string,
		serverId?: string,
		roleId?: string,
	},
	api?: {
		port: number,
		token: string,
		cors: string[],
	},
	logTransports?: {
		console?: {
			level?: 'debug' | 'verbose' | 'info' | 'warn' | 'error',
		},
		datadog?: {
			level?: 'debug' | 'verbose' | 'info' | 'warn' | 'error',
		},
		loki?: {
			host: string,
			level?: 'debug' | 'verbose' | 'info' | 'warn' | 'error',
		},
		file?: {
			level?: 'debug' | 'verbose' | 'info' | 'warn' | 'error',
		},
	},
	sentry?: {
		dsn: string,
	},
}

export interface BaseConfigCheck {
	[key: string]: any & Required<BaseConfig>
}

export interface MasterConfig extends BaseConfig {
	mode: 'master',
	discord: {
		token: string,
		defaultPrefix: string,
		developerPrefix: string,
	},
	mongodb: {
		username: string,
		password: string,
		host: string,
		database: string,
		protocol?: 'mongodb' | 'mongodb+srv',
	},
	overrides?: never,
	api: {
		port: number,
		token: string,
		cors: string[],
	},
}

export interface SlaveConfig extends BaseConfig {
	mode: 'slave',
	overrides?: {
		mongodb?: {
			username: string,
			password: string,
			host: string,
			database: string,
			protocol?: 'mongodb' | 'mongodb+srv',
		},
		youtube?: {
			database?: boolean,
			apiurl?: string,
		},
		twitter?: {
			consumerKey: string,
			consumerSecret: string,
			accessTokenKey: string,
			accessTokenSecret: string,
		},
		discord?: {
			defaultPrefix?: string,
			developerPrefix?: string,
		},
	},
	api?: never,
	mongodb?: never,
	twitter?: never,
}

export interface StandAloneConfig extends BaseConfig {
	mode: 'standalone',
	discord: {
		token: string,
		defaultPrefix: string,
		developerPrefix: string,
	},
	mongodb: {
		username: string,
		password: string,
		host: string,
		database: string,
		protocol?: 'mongodb' | 'mongodb+srv',
	},
	overrides?: never,
}

export interface DeveloperUser {
	type: 'user',
	userId: string,
	roleId?: never,
	serverId?: never,
}

export interface DeveloperRole {
	type: 'role',
	userId?: never,
	roleId: string,
	serverId: string,
}
