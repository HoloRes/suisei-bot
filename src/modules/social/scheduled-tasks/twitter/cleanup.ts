import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { Time } from '@sapphire/time-utilities';

export class TwitterCleanupTask extends ScheduledTask {
	public constructor(context: ScheduledTask.Context, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'twitterCleanup',
			pattern: '0 0 * * 0',
		});
	}

	public async run() {
		await this.container.db.twitterShare.deleteMany({
			where: {
				date: {
					lte: new Date(Date.now() - Time.Week),
				},
			},
		});
	}
}
