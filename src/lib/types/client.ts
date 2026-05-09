import { SapphireClientOptions } from '@sapphire/framework';
import type { Counter } from 'prom-client';

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
