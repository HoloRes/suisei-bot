import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';

export class TwitterCleanupTask extends ScheduledTask {
	public constructor(context: ScheduledTask.Context, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'twitterCleanup',
			pattern: '0 0 1 * *',
		});
	}

	public async run() {
		await this.container.db.twitterLeaderboardUser.updateMany({
			where: {
				sharesThisMonth: {
					gt: 0,
				},
			},
			data: {
				sharesThisMonth: 0,
			},
		});
	}
}
