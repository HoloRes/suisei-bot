import { ApplyOptions } from '@sapphire/decorators';
import {
	Events, Listener, ListenerOptions,
} from '@sapphire/framework';
import { Guild } from 'discord.js';
import flagsmith from 'flagsmith-nodejs';

@ApplyOptions<ListenerOptions>({ event: Events.GuildCreate })
export class GuildCreateListener extends Listener<typeof Events.GuildCreate> {
	public async run(guild: Guild) {
		await this.container.db.server.create({
			data: {
				id: guild.id,
				modules: JSON.parse(await flagsmith.getValue('auto_enabled_modules') as string) as string[],
			},
		});
	}
}
