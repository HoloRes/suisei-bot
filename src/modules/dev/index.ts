// Packages
import Discord from 'discord.js';
import Sentry from '@sentry/node';

// Local files
import Module from '../../lib/Module';
import { IConfig } from '../../types';

const config: IConfig = require('../../../config');

class DevModule extends Module {
	permissionCheck(message: Discord.Message): boolean {
		if (config.developer.type === 'role') {
			this.client?.guilds.fetch(<Discord.Snowflake>config.developer.serverId)
				.then((guild: Discord.Guild) => {
					guild.members.fetch(message.author.id)
						// eslint-disable-next-line max-len
						.then((member: Discord.GuildMember) => member.roles.cache.has(<Discord.Snowflake>config.developer.roleId))
						.catch((err) => {
							Sentry.captureException(err);
							this.logger?.error(err);
							return false;
						});
				})
				.catch((err) => {
					Sentry.captureException(err);
					this.logger?.error(err);
					return false;
				});
		} else if (config.developer.type === 'user') {
			return message.author.id === config.developer.userId;
		}
		return false;
	}

	commandHandler() {
		this.client?.on('message', (message) => {
			if (message.author.bot || message.channel.type === 'dm') return;
			if (!this.permissionCheck(message)) return;

			if (!message.content.startsWith(config.discord.developerPrefix)) return;

			const split = message.content.slice(config.discord.developerPrefix.length).split(' ');
			const args = split.slice(1).join(' ').trim().split(' ');

			const command = this.commands.get(split[0]);
			if (command) command.run(this.client, message, args);
		});
	}
}

export default new DevModule(__dirname, []);
