import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '#src/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/guilds/:guildId/moderation/config', methods: ['GET', 'PUT'] })
export class ModerationConfigRoute extends Route {
	@authenticated()
	public async run(request: ApiRequest, response: ApiResponse) {
		if (request.method === 'GET') {
			const config = await this.container.db.moderationGuildConfig.findUnique({
				where: {
					guildId: request.params.guildId,
				},
			});

			response.status(200).json(config);
			return;
		}

		if (request.method === 'PUT') {
			const body = await request.readBodyJson() as any;

			await this.container.db.moderationGuildConfig.upsert({
				where: {
					guildId: request.params.guildId,
				},
				update: body,
				create: {
					guildId: request.params.guildId,
					...body,
				},
			});

			response.status(204).end();
		}
	}
}
