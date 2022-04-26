import { SuiseiClient } from '../SuiseiClient';

export default async function loadModules(client?: SuiseiClient) {
	// Pull from module api, update if necessary and run db migrations
	await client?.destroy();
}
