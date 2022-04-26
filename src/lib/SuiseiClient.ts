import { SapphireClient, container } from '@sapphire/framework';
import { Enumerable } from '@sapphire/decorators';
import { PrismaClient } from '@prisma/client';
import { ClientOptions } from 'discord.js';

export class SuiseiClient extends SapphireClient {
	@Enumerable(false)
	public dev = process.env.NODE_ENV !== 'production';

	public constructor(options: ClientOptions) {
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

		super({
			...options,
		} as any);
	}

	public async destroy() {
		await container.db.$disconnect();
		return super.destroy();
	}
}

container.isMaster = () => container.config.mode === 'master';
container.isSlave = () => container.config.mode === 'slave';
