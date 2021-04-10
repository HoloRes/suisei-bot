// Imports
import Discord from 'discord.js';
import Sentry from '@sentry/node';

// Types
import { CallbackError } from 'mongoose';

// Local files
import Message from '../../../lib/Message';
import { logger } from '../../../index';

// Models
import AutoPublish, { IAutoPublish } from '../../../models/AutoPublish';

export function run(client: Discord.Client, message: Discord.Message, args: string[]): void {
	if (!args[0]) {
		message.channel.send('USAGE: <prefix>autopublish channel');
		return;
	}

	Message.getChannel(message, args[0])
		// eslint-disable-next-line consistent-return
		.then((channel) => {
			if (!channel) return message.channel.send('ERROR: Channel not found.');
			// eslint-disable-next-line consistent-return
			AutoPublish.findById(channel.id, (err: CallbackError|undefined, doc: IAutoPublish) => {
				if (err) {
					Sentry.captureException(err);
					logger.error(err);
					return message.channel.send('Something went wrong, please try again.');
				}
				if (doc) {
					AutoPublish.findByIdAndDelete(channel.id, {}, (err2: CallbackError|undefined) => {
						if (err2) {
							Sentry.captureException(err2);
							logger.error(err2);
							return message.channel.send('Something went wrong, please try again.');
						}
						return message.channel.send(`Auto publishing for <#${channel.id}> is now **disabled**`);
					});
				} else {
					const autoPublishDoc = new AutoPublish({
						_id: channel.id,
					});
					autoPublishDoc.save((err2: CallbackError|undefined) => {
						if (err2) {
							Sentry.captureException(err2);
							logger.error(err2);
							return message.channel.send('Something went wrong, please try again.');
						}
						return message.channel.send(`Auto publishing for <#${channel.id}> is now **enabled**`);
					});
				}
			});
		});
}

export const config = {
	command: 'autopublish',
};
