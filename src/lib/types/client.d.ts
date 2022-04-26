import type { Logger } from 'winston';
import { SapphireClientOptions } from '@sapphire/framework';
import type { PrismaClient } from '@prisma/client';
import { MasterConfig, SlaveConfig, StandAloneConfig } from './config';
import type { SuiseiClient } from '../SuiseiClient';

declare module 'discord.js' {
	interface Client {
	}

	interface ClientOptions extends SapphireClientOptions {
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		db: PrismaClient;
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
