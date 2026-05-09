import { Events, Listener, ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import handleMessage from '#src/lib/twitter/handleMessage';

@ApplyOptions<ListenerOptions>({ event: Events.MessageUpdate })
export class MessageCreateClass extends Listener<typeof Events.MessageUpdate> {
	public override async run(...[_oldMessage, newMessage]: Parameters<Listener<typeof Events.MessageUpdate>['run']>): Promise<void> {
		await handleMessage.bind(this)(newMessage);
	}
}
