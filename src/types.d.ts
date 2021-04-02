import Discord from 'discord.js';

export interface Command {
	run: <C = Discord.Client, M = Discord.Message, A = string[]>(client: C, message: M, args: A) => void,
	config: {
		command: string,
		module: string,
		permissionLevel: Discord.PermissionString
	}
}

export interface DevCommand extends Command {
	config: {
		command: string,
		module: never,
		permissionLevel: never
	}
}

export interface ExtendedClient extends Discord.Client {
	commands: Discord.Collection<name<string>, Command>,
	devCommands: Discord.Collection<name<string>, DevCommand>
}
