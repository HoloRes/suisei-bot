// * For more info configuring the bot, see the documentation: <link>

module.exports = {
	mode: 'standalone',
	modules: {
		developer: false,
		youtube: true,
		twitter: true,
		moderation: true,
		pingLists: true,
		utility: true,
		autoPublish: true,
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
