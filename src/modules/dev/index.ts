// Local files
import Module from '../../lib/Module';

const config = require('../../../config');

class DevModule extends Module {
	commandHandler() {
		this.client?.on('message', (message) => {
			if (message.author.bot || message.channel.type === 'dm') return;

			if (!message.content.startsWith(config.discord.developerPrefix)) return;

			const split = message.content.slice(config.discord.developerPrefix.length).split(' ');
			const args = split.slice(1).join(' ').trim().split(' ');

			const command = this.commands.get(split[0]);
			if (command) command.run(this.client, message, args);
		});
	}
}

const MiscModule = new DevModule(__dirname, []);

export default MiscModule;
