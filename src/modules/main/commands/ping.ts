// Imports
import Discord from 'discord.js';

export function run(client: Discord.Client, message: Discord.Message): void {
	message.reply('pong! 🏓');
}

export const config = {
	command: 'ping',
};
