import { SapphireClientOptions } from '@sapphire/framework';
import type { PrismaClient } from '@prisma/client';
import type { Counter } from 'prom-client';
import type BansApiClient from '@holores/bansapi.js';
import Config from './config';

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
		bansApi: BansApiClient;
		// remoteConfig: IFlagsmith;
		config: Config;
		counters: Counters;
	}
}
