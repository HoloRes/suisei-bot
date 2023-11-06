import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, methods, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '@/lib/api/authenticated';

interface Body {
	actions: {
		internalId?: string;
		action: 'WARN' | 'MUTE' | 'KICK' | 'BAN';
		duration: number | null | undefined;
	}[];
}

@ApplyOptions<RouteOptions>({ route: '/guilds/:guildId/moderation/strikeConfig' })
export class ModerationStrikeConfigRoute extends Route {
	@authenticated()
	public async [methods.POST](request: ApiRequest, response: ApiResponse) {
		const config = await this.container.db.moderationGuildConfig.findUnique({
			where: {
				guildId: request.params.guildId,
			},
			select: {
				guildId: true,
			},
		});

		if (!config) {
			response.status(400).end();
			return;
		}

		try {
			await this.container.db.moderationGuildConfig.update({
				where: {
					guildId: request.params.guildId,
				},
				data: {
					strikes: (request.body as Body).actions.map((action) => {
						const updatedAction = { ...action };
						delete updatedAction.internalId;

						if (action.action !== 'MUTE' && action.action !== 'BAN') {
							delete updatedAction.duration;
						}

						return updatedAction;
					}),
				},
			});
		} catch (e) {
			this.container.logger.error(e);
			response.status(500).end();
			return;
		}

		response.status(204).end();
	}
}
