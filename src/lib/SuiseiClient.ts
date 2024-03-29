import { container, SapphireClient, SapphireClientOptions } from '@sapphire/framework';
import { Enumerable } from '@sapphire/decorators';
import { PrismaClient } from '@prisma/client';
import HolodexClient from '@holores/holodex';
import { MeiliSearch } from 'meilisearch';
import * as Retraced from '@retracedhq/retraced';
import type { ClientOptions } from 'discord.js';
import { getRootData } from '@sapphire/pieces';
import { join } from 'node:path';
import { Humanizer, humanizer } from 'humanize-duration';
import BansApiClient from '@holores/bansapi.js';
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
		container.db = new PrismaClient({
			datasources: {
				db: {
					url: `${container.config.db.protocol}://${container.config.db.username}:${container.config.db.password}@${container.config.db.host}/${container.config.db.database}${container.config.db.query ?? ''}`,
				},
			},
		});

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
		container.meiliClient = new MeiliSearch({
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

/* eslint-disable no-unused-vars, no-use-before-define */
declare module 'discord.js' {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface Client {
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-interface,@typescript-eslint/no-shadow
	interface ClientOptions extends SapphireClientOptions {
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		db: PrismaClient;
		// remoteConfig: IFlagsmith;
		bansApi: BansApiClient;
		holodexClient: HolodexClient;
		retracedClient: Retraced.Client;
		meiliClient: MeiliSearch;
		config: Config;
		counters: Counters;
		humanizeDuration: Humanizer;
	}
}
