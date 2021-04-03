import Discord from 'discord.js';

export interface Command {
	run: <C = Discord.Client, M = Discord.Message, A = string[]>(client: C, message: M, args: A) => void,
	config: {
		command: string,
		module: string,
		permissionLevel: Discord.PermissionString,
	},
}

export interface DevCommand extends Command {
	config: {
		command: string,
		module: never,
		permissionLevel: never,
	}
}

export interface ExtendedClient extends Discord.Client {
	commands: Discord.Collection<name<string>, Command>,
	devCommands: Discord.Collection<name<string>, DevCommand>,
}

export interface Config {
	mode: 'standalone' | 'master' | 'slave',
	modules: {
		developer: boolean,
		moderation: boolean,
		youtube: boolean,
		twitter: boolean,
		pingLists: boolean,
	},
	discord: {
		token: string,
		defaultPrefix?: string,
		developerPrefix?: string,
	},
	developer: {
		type: 'user' | 'role',
		userId?: string,
		serverId?: string,
		roleId?: string,
	},
	overrides?: {
		mongodb?: {
			username: string,
			password: string,
			host: string,
			database: string,
			protocol?: 'mongodb' | 'mongodb+srv'
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
		}
	},
	twitter?: {
		consumerKey: string,
		consumerSecret: string,
		accessTokenKey: string,
		accessTokenSecret: string,
	},
	mongodb?: {
		username: string,
		password: string,
		host: string,
		database: string,
		protocol?: 'mongodb' | 'mongodb+srv',
	},
	api?: {
		port: number,
		token: string,
		cors: string[],
	},
	sentryDsn?: string,
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
}
