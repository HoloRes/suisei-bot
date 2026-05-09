import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '#src/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/guilds', methods: ['GET'] })
export class GuildsRoute extends Route {
	@authenticated()
	public async run(_request: ApiRequest, response: ApiResponse) {
		await this.container.client.guilds.fetch();
		response.status(200).json(this.container.client.guilds.cache.map((guild) => guild.id));
	}
}
