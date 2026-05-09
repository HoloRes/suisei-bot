import { z } from 'zod';

const logLevelSchema = z.enum(['debug', 'verbose', 'info', 'warn', 'error']);

const configSchema = z.object({
	discord: z.object({
		token: z.string(),
		id: z.string(),
		secret: z.string(),
	}),
	config: z.object({
		environmentId: z.string(),
		api: z.string().optional(),
	}),
	db: z.object({
		username: z.string(),
		password: z.string(),
		database: z.string(),
		host: z.string(),
		protocol: z.string(),
		query: z.string().optional(),
	}),
	redis: z.object({
		password: z.string().optional(),
		host: z.string(),
		port: z.number().optional(),
		db: z.number().optional(),
	}),
	meilisearch: z.object({
		host: z.string(),
		key: z.string(),
	}),
	retraced: z.object({
		endpoint: z.string(),
		projectId: z.string(),
		apiKey: z.string(),
	}),
	owners: z.array(z.string()),
	api: z.object({
		port: z.number(),
		baseUrl: z.string(),
		origin: z.string().optional(),
		adminKey: z.string(),
	}),
	overrides: z.object({
		discord: z.object({
			defaultPrefix: z.string().optional(),
			developerPrefix: z.string().optional(),
		}).optional(),
	}).optional(),
	logLevel: logLevelSchema.optional(),
	logTransports: z.object({
		console: z.object({
			level: logLevelSchema.optional(),
		}).optional(),
		loki: z.object({
			host: z.string(),
			level: logLevelSchema.optional(),
		}).optional(),
		file: z.object({
			level: logLevelSchema.optional(),
		}).optional(),
	}).optional(),
	holodex: z.object({
		apikey: z.string(),
	}),
	bansApi: z.object({
		keyId: z.string(),
		apiKey: z.string(),
		endpoint: z.string().optional(),
		rabbitmqEndpoint: z.string().optional(),
	}),
	twitter: z.object({
		managementGuilds: z.array(z.string()),
	}),
	sentry: z.object({
		dsn: z.string(),
	}).optional(),
});

export function checkConfig(config: unknown): config is Config {
	const result = configSchema.safeParse(config);
	if (result.success) return true;

	console.error(result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('\n'));
	return false;
}

type Config = z.infer<typeof configSchema>;
export default Config;
