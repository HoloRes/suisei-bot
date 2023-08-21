import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';
import handleMessage from '../../../../lib/twitter/handleMessage';

@ApplyOptions<ListenerOptions>({ event: Events.MessageUpdate })
export class messageCreateClass extends Listener<typeof Events.MessageUpdate> {
	public override async run(message: Message): Promise<void> {
		await handleMessage.bind(this)(message);
	}
}
