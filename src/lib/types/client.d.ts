import { SapphireClientOptions } from '@sapphire/framework';
import { PrismaClient } from '@prisma/client';
import { Counter, Histogram } from 'prom-client';
import { MasterConfig, SlaveConfig, StandAloneConfig } from './config';

declare module 'discord.js' {
	interface Client {
	}

	interface ClientOptions extends SapphireClientOptions {
	}
}

export interface Counters {
	youtube: {
		total: Counter;
		success: Counter;
	};
}

declare module '@sapphire/pieces' {
	interface Container {
		db: PrismaClient;
		// remoteConfig: IFlagsmith;
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
