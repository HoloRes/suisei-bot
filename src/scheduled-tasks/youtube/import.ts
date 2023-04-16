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
			name: 'vtuberImport',
			pattern: '0 0 * * 0',
		});
	}

	public async run() {
		this.container.logger.info('Started import of all VTuber channels from Holodex');

		let page = 0;
		let finished = false;
		const tasks: Promise<any>[] = [];
		const documents: VTuber[] = [];

		const fetchNextPage = async () => {
			this.container.logger.debug(`Fetching page ${page}`);

			const currentPage = await this.container.holodexClient.channels.list({
				offset: page * 100,
				limit: 100,
				order: 'asc',
				type: 'vtuber',
			});

			// Return early if there is nothing to process
			if (currentPage.length === 0) {
				finished = true;
				return;
			}

			currentPage.forEach((vtuber) => {
				documents.push({
					id: vtuber.id,
					name: vtuber.name,
					englishName: vtuber.englishName,
					org: vtuber.org,
					subOrg: vtuber.subOrg,
				});

				const info = {
					name: vtuber.name,
					englishName: vtuber.englishName,
					photo: vtuber.photo,
					org: vtuber.org,
					subOrg: vtuber.subOrg,
				};

				tasks.push(
					this.container.db.youtubeChannel.upsert({
						where: {
							id: vtuber.id,
						},
						create: {
							id: vtuber.id,
							...info,
						},
						update: info,
					}),
				);
			});

			page += 1;
		};

		while (!finished) {
			/*
			 We await on purpose, instead of throwing it in an array and doing Promise.all.
			 This is to not push a ton of requests onto the Holodex API and because we have no clue
			 how many channels there are, so do not know when to stop calling the API
			 */
			// eslint-disable-next-line no-await-in-loop
			await fetchNextPage();
		}

		this.container.logger.debug('Create MeiliSearch task');
		tasks.push(
			this.container.meiliClient.index('vtubers')
				.addDocuments(documents),
		);

		this.container.logger.debug('Waiting on promises');
		await Promise.all(tasks);

		this.container.logger.info('Successfully imported all VTuber channels from Holodex');
	}
}

/* eslint-disable no-unused-vars */
declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		cron: never;
		manual: never;
	}
}
