import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, methods, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '@/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/guilds/:guildId/roles' })
export class GuildRolesTokenRoute extends Route {
	@authenticated()
	public async [methods.GET](request: ApiRequest, response: ApiResponse) {
		const guild = await this.container.client.guilds.fetch(request.params.guildId).catch(() => {});
		if (!guild) {
			response.status(400).end();
			return;
		}
		response.status(200).json(
			guild.roles.cache
				.filter((role) => !role.managed && !role.tags?.integrationId && !role.tags?.botId && role.name !== '@everyone')
				.map((role) => ({
					id: role.id,
					name: role.name,
					type: role.color,
				})),
		);
	}
}
