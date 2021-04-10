// Packages
import Discord from 'discord.js';
import fs from 'fs';
import * as path from 'path';

// Types
import { ICommand, IConfig } from '../../types/index';

// Local files
const config: IConfig = require('../../../config');

// Variables
const commands = new Discord.Collection() as Discord.Collection<string, ICommand>;

function reloadCommands(): void {
	commands.forEach((cmd) => {
		commands.delete(cmd.config.command);
		delete require.cache[require.resolve(`./commands/${cmd.config.command}.js`)];
	});

	fs.readdir(path.resolve(__dirname, 'commands'), (err, files) => {
		if (err) throw err;

		const filteredFiles = files.filter((file) => file.split('.').pop() === 'js' || file.split('.').pop() === 'ts');

		filteredFiles.forEach((file) => {
			delete require.cache[require.resolve(`./commands/${file}`)];

			// eslint-disable-next-line global-require,import/no-dynamic-require
			const command = require(`./commands/${file}`);
			commands.set(command.config.command, command);
		});
	});
}

function start(client: Discord.Client): void {
	reloadCommands();

	client.on('message', (message) => {
		if (message.author.bot || message.channel.type === 'dm') return;

		if (!message.content.startsWith(config.discord.defaultPrefix)) return;

		const split = message.content.slice(config.discord.defaultPrefix.length).split(' ');
		const args = split.slice(1).join(' ').trim().split(' ');

		const command = commands.get(split[0]);
		if (command) command.run(client, message, args);
	});
}

export default { start, reloadCommands };
