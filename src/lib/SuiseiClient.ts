import { container, SapphireClient, SapphireClientOptions } from '@sapphire/framework';
import { Enumerable } from '@sapphire/decorators';
import { PrismaClient } from '@prisma/client';
import HolodexClient from '@holores/holodex';
import { MeiliSearch } from 'meilisearch';
import { MasterConfig, SlaveConfig, StandAloneConfig } from './types/config';
import { Counters } from './types/client';

export class SuiseiClient extends SapphireClient {
	@Enumerable(false)
	public dev = process.env.NODE_ENV !== 'production';

	public override async login(token: string) {
		// Connect to the database
		let connectionUrl: string;
		if (container.isSlave()) {
			// TODO: Init communication system with master node
			connectionUrl = `protocol://${container.config.network.clientId}:${container.config.network.token}@host/database?query`;
		} else {
			connectionUrl = `${container.config.db!.protocol}://${container.config.db!.username}:${container.config.db!.password}@${container.config.db!.host}/${container.config.db!.database}${container.config.db!.query ?? ''}`;
		}

		container.db = new PrismaClient({
			datasources: {
				db: {
					url: connectionUrl,
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

container.isMaster = () => container.config.mode === 'master';
container.isSlave = () => container.config.mode === 'slave';

/* eslint-disable no-unused-vars, no-use-before-define */
declare module 'discord.js' {
	interface Client {
	}

	interface ClientOptions extends SapphireClientOptions {
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		db: PrismaClient;
		// remoteConfig: IFlagsmith;
		holodexClient: HolodexClient;
		meiliClient: MeiliSearch;
		config: MasterConfig | SlaveConfig | StandAloneConfig;
		isMaster: () => this is MasterContainer;
		isSlave: () => this is SlaveContainer;
		counters: Counters;
	}

	interface SlaveContainer extends Container {
		isMaster: () => false;
		isSlave: () => true;
		config: SlaveConfig;
	}

	interface MasterContainer extends Container {
		isMaster: () => true;
		isSlave: () => false;
		config: MasterConfig;
	}
}
