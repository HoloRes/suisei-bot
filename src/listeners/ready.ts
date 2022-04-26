import { ApplyOptions } from '@sapphire/decorators';
import { Listener, ListenerOptions } from '@sapphire/framework';

@ApplyOptions<ListenerOptions>({ once: true })
export class ReadyListener extends Listener {
	public async run() {
		this.container.logger.info();
	}
}
