import { SapphireClientOptions } from '@sapphire/framework';
import { PrismaClient } from '@prisma/client';
import { Counter } from 'prom-client';
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
		// remoteConfig: IFlagsmith;
		config: Config;
		counters: Counters;
	}
}
