import { ApplyOptions } from '@sapphire/decorators';
import {
	ApiRequest, ApiResponse, methods, Route, RouteOptions,
} from '@sapphire/plugin-api';
import util from 'util';
import { authenticated } from '@/lib/api/authenticated';

@ApplyOptions<RouteOptions>({ route: '/eval' })
export class EvalRoute extends Route {
	@authenticated()
	public [methods.POST](request: ApiRequest, response: ApiResponse) {
		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		function clean(text: string | any) {
			if (typeof (text) === 'string') return text.replace(/'/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return text;
		}

		try {
			// eslint-disable-next-line no-eval,@typescript-eslint/no-unsafe-assignment
			let evaled: any = eval(request.body as string);

			if (typeof evaled !== 'string') { evaled = util.inspect(evaled); }

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			response.status(200).text(clean(evaled));
		} catch (err) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			response.status(200).text(clean(err));
		}
	}
}
