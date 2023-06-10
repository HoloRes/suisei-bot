import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';

interface VTuber {
	id: string;
	name: string;
	englishName?: string;
	org?: string;
	subOrg?: string;
}

export class VtuberImportTask extends ScheduledTask {
	public constructor(context: ScheduledTask.Context, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'vtuberMeiliImport',
		});
	}

	public async run() {
		this.container.logger.debug('Tasks[YouTube][migrate] Started import of all VTuber channels into MeiliSearch');

		const docs = await this.container.db.youtubeChannel.findMany({
			select: {
				id: true, name: true, englishName: true, org: true, subOrg: true,
			},
		}) as VTuber[];

		await this.container.meiliClient.index('vtubers')
			.addDocuments(docs);

		this.container.logger.debug('Tasks[YouTube][migrate] Successfully imported all VTuber channels to MeiliSearch');
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		manual: never;
	}
}
