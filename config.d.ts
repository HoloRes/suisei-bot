export const mode: string;
export const discord: {
	token: string,
	id: string,
	secret: string,
};
export const config: {
	environmentId: string,
};
export const owners: string[];
export const api: {
	port: number,
	baseUrl: string,
	origin: string,
	adminKey: string,
};
export const meilisearch: {
	host: string,
	key: string,
};
export const retraced: {
	endpoint: string;
	projectId: string;
	apiKey: string;
};
export const redis: {
	host: string,
	port: number,
};
export const db: {
	username: string,
	password: string,
	database: string,
	host: string,
	protocol: string,
	query: string,
};
export const holodex: {
	apikey: string,
};
export const bansApi: {
	endpoint: string,
	rabbitmqEndpoint: string,
	keyId: string,
	apiKey: string,
};
export const twitter: {
	managementGuilds: string[],
};
export const logTransports: {
	console: {
		level: string,
	},
}
