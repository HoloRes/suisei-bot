import { container, SapphireClient, SapphireClientOptions } from '@sapphire/framework';
import { Enumerable } from '@sapphire/decorators';
import { PrismaClient } from '@prisma/client';
import HolodexClient from '@holores/holodex';
import { MeiliSearch } from 'meilisearch';
import type { ClientOptions } from 'discord.js';
import { getRootData } from '@sapphire/pieces';
import { join } from 'node:path';
import type Config from './types/config';
import { Counters } from './types/client';

export class SuiseiClient extends SapphireClient {
	private rootData = getRootData();

	@Enumerable(false)
	public dev = process.env.NODE_ENV !== 'production';

	public constructor(options: ClientOptions) {
		super(options);

		this.stores.registerPath(join(this.rootData.root, 'modules/core'));
		this.stores.registerPath(join(this.rootData.root, 'modules/youtube'));
		this.stores.registerPath(join(this.rootData.root, 'modules/moderation'));
	}

	public override async login(token: string) {
		container.db = new PrismaClient({
			datasources: {
				db: {
					url: `${container.config.db!.protocol}://${container.config.db!.username}:${container.config.db!.password}@${container.config.db!.host}/${container.config.db!.database}${container.config.db!.query ?? ''}`,
				},
			},
		});

		// Set Holodex API key
		container.holodexClient = new HolodexClient({
			apiKey: container.config.holodex?.apikey ?? '',
		});

		// Connect to MeiliSearch
		container.meiliClient = new MeiliSearch({
			host: container.config.meilisearch!.host,
			apiKey: container.config.meilisearch!.key,
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
	interface Client {
	}

	// eslint-disable-next-line no-shadow
	interface ClientOptions extends SapphireClientOptions {
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		db: PrismaClient;
		// remoteConfig: IFlagsmith;
		holodexClient: HolodexClient;
		meiliClient: MeiliSearch;
		config: Config;
		counters: Counters;
	}
}
