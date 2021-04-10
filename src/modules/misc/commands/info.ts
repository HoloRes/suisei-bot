// Packages
import Discord from 'discord.js';

// Local files
const packageJson = require('../../../../package.json');

export function run(client: Discord.Client, message: Discord.Message): void {
	const embed = new Discord.MessageEmbed()
		.setTitle('Suisei')
		.setURL('https://github.com/HoloRes/suisei')
		.setDescription('Status information: [statuspage](https://status.hlresort.community)')
		.setFooter(`Running version: ${packageJson.version ?? 'unknown'} (SHA: ${process.env.COMMIT_SHA?.substring(0, 8) ?? 'unknown'})`)
		.setTimestamp();

	message.channel.send(embed);
}

export const config = {
	command: 'info',
};
