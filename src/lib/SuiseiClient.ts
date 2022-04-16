import { SapphireClient, type SapphireClientOptions, container } from '@sapphire/framework';
import { Enumerable } from '@sapphire/decorators';
import { PrismaClient } from '@prisma/client';
import { ClientOptions } from 'discord.js';
import { Logger } from 'winston';
import { MasterConfig, SlaveConfig, StandAloneConfig } from './types/config';

export class SuiseiClient extends SapphireClient {
	@Enumerable(false)
	public dev = process.env.NODE_ENV !== 'production';

	public constructor(options: ClientOptions) {
		super({
			...options,
		} as any);

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
	}

	public async destroy() {
		await container.db?.$disconnect();
		return super.destroy();
	}
}

container.isMaster = () => container.config.mode === 'master';
container.isSlave = () => container.config.mode === 'slave';

/* eslint-disable no-shadow,no-unused-vars,no-use-before-define */
declare module 'discord.js' {
	interface Client {
	}

	interface ClientOptions extends SapphireClientOptions {
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		db: PrismaClient;
		// @ts-expect-error types not overlapping
		logger: Logger;
		config: MasterConfig | SlaveConfig | StandAloneConfig;
		isMaster: () => this is MasterContainer;
		isSlave: () => this is SlaveContainer;
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
