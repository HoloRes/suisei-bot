import { ApplyOptions } from '@sapphire/decorators';
import {
	Events, Listener, ListenerOptions,
} from '@sapphire/framework';
import { Guild } from 'discord.js';

@ApplyOptions<ListenerOptions>({ event: Events.GuildCreate })
export class GuildCreateListener extends Listener<typeof Events.GuildCreate> {
	public override async run(guild: Guild) {
		await this.container.db.server.create({
			data: {
				id: guild.id,
			},
		});
	}
}
