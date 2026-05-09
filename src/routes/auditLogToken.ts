import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '#src/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/guilds/:guildId/auditLogToken', methods: ['GET'] })
export class AuditLogTokenRoute extends Route {
	@authenticated()
	public async run(request: ApiRequest, response: ApiResponse) {
		response.status(200).text(await this.container.retracedClient.getViewerToken(request.params.guildId, ''));
	}
}
