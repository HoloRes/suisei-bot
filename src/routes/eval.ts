import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, Route, RouteOptions,
} from '@sapphire/plugin-api';
import util from 'util';
import { authenticated } from '#src/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/eval', methods: ['POST'] })
export class EvalRoute extends Route {
	@authenticated()
	public async run(request: ApiRequest, response: ApiResponse) {
		function clean(text: string | any) {
			if (typeof (text) === 'string') return text.replace(/'/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);

			return text;
		}

		try {
			const body = await request.readBodyText();
			// eslint-disable-next-line no-eval
			let evaled: any = eval(body);

			if (typeof evaled !== 'string') {
				evaled = util.inspect(evaled);
			}

			response.status(200).text(clean(evaled));
		} catch (err) {
			response.status(200).text(clean(err));
		}
	}
}
