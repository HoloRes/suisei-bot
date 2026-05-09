import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '#src/lib/api/authenticated';

interface Body {
	actions: {
		internalId?: string;
		action: 'WARN' | 'MUTE' | 'KICK' | 'BAN';
		duration: number | null | undefined;
	}[];
}

@ApplyOptions<RouteOptions>({ route: '/guilds/:guildId/moderation/strikeConfig', methods: ['POST'] })
export class ModerationStrikeConfigRoute extends Route {
	@authenticated()
	public async run(request: ApiRequest, response: ApiResponse) {
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
			const body = await request.readBodyJson() as Body;

			await this.container.db.moderationGuildConfig.update({
				where: {
					guildId: request.params.guildId,
				},
				data: {
					strikes: body.actions.map((action) => {
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
