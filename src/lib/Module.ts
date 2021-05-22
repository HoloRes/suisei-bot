// Packages
import Discord from 'discord.js';
import fs from 'fs';
import * as path from 'path';

// Types
import winston from 'winston';
import { ICommand } from '../types';

// Local files
const config = require('../../config');

export default class Module {
	private readonly directory: string;

	protected logger: winston.Logger | undefined;

	protected client: Discord.Client | undefined;

	protected commands: Discord.Collection<string, ICommand>;

	public readonly availableSettings: string[];

	constructor(directory: string, availableSettings: string[]) {
		this.directory = directory;
		this.availableSettings = availableSettings;

		this.commands = new Discord.Collection() as Discord.Collection<string, ICommand>;
	}

	reload(): void {
		this.commands.forEach((cmd) => {
			this.commands.delete(cmd.config.command);
			delete require.cache[require.resolve(path.resolve(this.directory, `commands/${cmd.config.command}.js`))];
		});

		fs.readdir(path.resolve(this.directory, 'commands'), (err, files) => {
			if (err) throw err;

			const filteredFiles = files.filter((file) => file.split('.').pop() === 'js' || file.split('.').pop() === 'ts');

			filteredFiles.forEach((file) => {
				delete require.cache[require.resolve(path.resolve(this.directory, `commands/${file}`))];

				// eslint-disable-next-line global-require,import/no-dynamic-require
				const command = require(path.resolve(this.directory, `commands/${file}`));
				this.commands.set(command.config.command, command);
			});
		});
	}

	// eslint-disable-next-line class-methods-use-this,no-unused-vars
	permissionCheck(message: Discord.Message): boolean {
		return true;
	}

	commandHandler(): void {
		this.client?.on('message', (message) => {
			if (message.author.bot || message.channel.type === 'dm') return;
			if (!this.permissionCheck(message)) return;

			if (!message.content.startsWith(config.discord.defaultPrefix)) return;

			const split = message.content.slice(config.discord.defaultPrefix.length).split(' ');
			const args = split.slice(1).join(' ').trim().split(' ');

			const command = this.commands.get(split[0]);
			if (command) command.run(this.client, message, args);
		});
	}

	slashCommandHandler(): void {
		this.client?.on('interaction', (interaction) => {
			if (!interaction.isCommand()) return;

			// @ts-expect-error Command is already checked above
			const command = this.commands.get(interaction.command.name);
			if (command) command.runSlash(interaction as Discord.CommandInteraction);
		});
	}

	start(client: Discord.Client, logger: winston.Logger): void {
		this.client = client;
		this.logger = logger;
		this.reload();
		this.commandHandler();
	}
}

export function getPrefix(): string {
	return config.defaultPrefix;
}
