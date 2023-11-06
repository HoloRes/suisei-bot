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
		});

		response.status(200).json(config);
	}

	@authenticated()
	public async [methods.PUT](request: ApiRequest, response: ApiResponse) {
		await this.container.db.moderationGuildConfig.upsert({
			where: {
				guildId: request.params.guildId,
			},
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			update: request.body as any,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			create: {
				guildId: request.params.guildId,
				...request.body as any,
			},
		});

		response.status(204).end();
	}
}
