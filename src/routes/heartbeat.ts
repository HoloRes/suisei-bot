import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, Route, RouteOptions,
} from '@sapphire/plugin-api';

@ApplyOptions<RouteOptions>({ route: '/heartbeat', methods: ['GET'] })
export class HeartbeatRoute extends Route {
	public async run(_request: ApiRequest, response: ApiResponse) {
		response.status(200).text('OK');
	}
}
