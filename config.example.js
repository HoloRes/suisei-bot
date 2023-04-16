// * For more info configuring the bot, see the documentation: https://docs.suisei.app

module.exports = {
	mode: 'standalone',
	developer: {
		type: 'user',
		userId: '000000000000000000',
	},
	discord: {
		token: '',
		id: '',
		secret: '',
	},
	api: {
		port: 80,
		adminKey: 'admin',
		cors: ['http://example.com'],
	},
	db: {
		username: '',
		password: '',
		database: '',
		host: '',
		protocol: '',
		query: '',
	},
	logTransports: {
		file: {
			level: 'verbose',
		},
	},
	sentry: {
		dsn: '',
	},
};
