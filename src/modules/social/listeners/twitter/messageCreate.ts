import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';
import handleMessage from '../../../../lib/twitter/handleMessage';

@ApplyOptions<ListenerOptions>({ event: Events.MessageCreate })
export class MessageCreateClass extends Listener<typeof Events.MessageCreate> {
	public override async run(message: Message): Promise<void> {
		await handleMessage.bind(this)(message);
	}
}
