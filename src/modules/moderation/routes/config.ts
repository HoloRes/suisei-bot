import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, methods, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '@/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/guilds/:guildId/moderation/config' })
export class ModerationConfigRoute extends Route {
	@authenticated()
	public async [methods.GET](request: ApiRequest, response: ApiResponse) {
		const config = await this.container.db.moderationGuildConfig.findUnique({
			where: {
				guildId: request.params.guildId,
			},
			include: {
				strikes: true,
			},
		});

		response.status(200).json(config);
	}
}
