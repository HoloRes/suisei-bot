import { SapphireClientOptions } from '@sapphire/framework';
import type { Counter } from 'prom-client';

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
