// * For more info configuring the bot, see the documentation: https://docs.suisei.app

module.exports = {
	mode: 'standalone',
	modules: {
		// Do not modify what you don't understand, this WILL break functionality
	},
	developer: {
		type: 'user',
		userId: '000000000000000000',
	},
	discord: {
		token: '',
		defaultPrefix: '!',
		developerPrefix: '_',
	},
	mongodb: {
		username: '',
		password: '',
		database: '',
		host: '',
		protocol: 'mongodb',
	},
	api: {
		port: 80,
		token: 'admin',
		cors: ['http://example.com'],
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
