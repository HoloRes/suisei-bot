import { createFunctionPrecondition } from '@sapphire/decorators';
import { ApiRequest, ApiResponse, HttpCodes } from '@sapphire/plugin-api';
import { container } from '@sapphire/framework';

export const authenticated = () => createFunctionPrecondition(
	(request: ApiRequest) => Boolean(
		container.config.api?.adminKey
		&& request.headers.authorization === container.config.api.adminKey,
	),
	(_request: ApiRequest, response: ApiResponse) => response.error(HttpCodes.Unauthorized),
);
