module.exports = {
	mode: 'standalone',
	discord: {
		token: '',
		id: '',
		secret: '',
	},
	config: {
		environmentId: '',
	},
	owners: [
		'YOUR USER ID HERE',
	],
	api: {
		port: 3001,
		baseUrl: 'http://localhost:3001',
		origin: 'http://localhost:3000',
		adminKey: 'TEST',
	},
	meilisearch: {
		host: 'http://localhost:7700',
		key: 'MASTER_KEY',
	},
	redis: {
		host: 'localhost',
		port: 6380,
	},
	db: {
		username: 'root',
		password: '',
		database: 'develop',
		host: '',
		protocol: '',
		query: '',
	},
	holodex: {
		apikey: '',
	},
	bansApi: {
		endpoint: 'http://localhost:3102',
		rabbitmqEndpoint: 'localhost:5672',
		keyId: 'test',
		apiKey: 'Fgf8d3UpXzwM',
	},
	twitter: {
		managementGuilds: ['TEST SERVER ID HERE'],
	},
	logTransports: {
		console: {
			level: 'debug',
		},
	},
};
