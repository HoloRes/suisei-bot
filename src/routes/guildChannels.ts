import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, methods, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '@/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/guilds/:guildId/channels' })
export class GuildChannelsRoute extends Route {
	@authenticated()
	public async [methods.GET](request: ApiRequest, response: ApiResponse) {
		const guild = await this.container.client.guilds.fetch(request.params.guildId).catch(() => {});
		if (!guild) {
			response.status(400).end();
			return;
		}
		response.status(200).json(
			guild.channels.cache
				.map((channel) => ({
					id: channel.id,
					name: channel.name,
					type: channel.type,
				})),
		);
	}
}
