import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, methods, Route, RouteOptions,
} from '@sapphire/plugin-api';
import { authenticated } from '@/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/guilds/:guildId/auditLogToken' })
export class AuditLogTokenRoute extends Route {
	@authenticated()
	public async [methods.GET](request: ApiRequest, response: ApiResponse) {
		response.status(200).text(await this.container.retracedClient.getViewerToken(request.params.guildId, ''));
	}
}
