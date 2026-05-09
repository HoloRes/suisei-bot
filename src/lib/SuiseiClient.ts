import { container, SapphireClient, SapphireClientOptions } from '@sapphire/framework';
import { Enumerable } from '@sapphire/decorators';
import HolodexClient from '@holores/holodex';
import { Meilisearch } from 'meilisearch';
import * as Retraced from '@retracedhq/retraced';
import type { ClientOptions } from 'discord.js';
import { getRootData } from '@sapphire/pieces';
import { join } from 'node:path';
import { Humanizer, humanizer } from 'humanize-duration';
import BansApiClient from '@holores/bansapi.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#src/generated/prisma/client';
import type Config from './types/config';
import { Counters } from './types/client';

export class SuiseiClient extends SapphireClient {
	private rootData = getRootData();

	@Enumerable(false)
	public dev = process.env.NODE_ENV !== 'production';

	public constructor(options: ClientOptions) {
		super(options);

		this.stores.registerPath(join(this.rootData.root, 'modules/core'));
		this.stores.registerPath(join(this.rootData.root, 'modules/social'));
		this.stores.registerPath(join(this.rootData.root, 'modules/moderation'));
	}

	public override async login(token: string) {
		const adapter = new PrismaPg({
			connectionString: `${container.config.db.protocol}://${container.config.db.username}:${container.config.db.password}@${container.config.db.host}/${container.config.db.database}${container.config.db.query ?? ''}`,
		});

		container.db = new PrismaClient({ adapter });

		// Set Holodex API key
		container.holodexClient = new HolodexClient({
			apiKey: container.config.holodex.apikey,
		});

		// Connect to Retraced
		container.retracedClient = new Retraced.Client({
			endpoint: container.config.retraced.endpoint,
			projectId: container.config.retraced.projectId,
			apiKey: container.config.retraced.apiKey,
		});

		// Connect to the Bans API
		container.bansApi = new BansApiClient({
			url: container.config.bansApi.endpoint,
			apiKey: container.config.bansApi.apiKey,
			amqp: {
				endpoint: container.config.bansApi.rabbitmqEndpoint,
				username: container.config.bansApi.keyId,
				topics: ['user'],
			},
		});

		// Connect to MeiliSearch
		container.meiliClient = new Meilisearch({
			host: container.config.meilisearch.host,
			apiKey: container.config.meilisearch.key,
		});

		// Create humanizer
		container.humanizeDuration = humanizer({
			largest: 2,
			round: true,
		});

		// Log into Discord
		return super.login(token);
	}

	public async destroy() {
		await container.db.$disconnect();
		return super.destroy();
	}
}

declare module 'discord.js' {

	interface Client {
	}

	interface ClientOptions extends SapphireClientOptions {
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		db: PrismaClient;
		bansApi: BansApiClient;
		holodexClient: HolodexClient;
		retracedClient: Retraced.Client;
		meiliClient: Meilisearch;
		config: Config;
		counters: Counters;
		humanizeDuration: Humanizer;
	}
}
