import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, methods, Route, RouteOptions,
} from '@sapphire/plugin-api';
import util from 'util';

@ApplyOptions<RouteOptions>({ route: '/eval' })
export class EvalRoute extends Route {
	public [methods.POST](request: ApiRequest, response: ApiResponse) {
		if (!this.container.config.api?.adminKey) {
			response.status(403).end();
			return;
		}
		if (request.headers.authorization !== this.container.config.api.adminKey) {
			response.status(401).end();
			return;
		}

		function clean(text: string | any) {
			if (typeof (text) === 'string') return text.replace(/'/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);
			return text;
		}

		try {
			// eslint-disable-next-line no-eval
			let evaled = eval(request.body as string);

			if (typeof evaled !== 'string') { evaled = util.inspect(evaled); }

			response.status(200).text(clean(evaled));
		} catch (err) {
			response.status(200).text(clean(err));
		}
	}
}
