import { SapphireClientOptions } from '@sapphire/framework';
import type { PrismaClient } from '@prisma/client';
import type { Counter } from 'prom-client';
import type BansApiClient from '@holores/bansapi.js';
import Config from './config';

declare module 'discord.js' {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface Client {
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
		bansApi: BansApiClient;
		// remoteConfig: IFlagsmith;
		config: Config;
		counters: Counters;
	}
}
