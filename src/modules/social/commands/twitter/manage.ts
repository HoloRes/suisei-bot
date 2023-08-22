import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Subcommand.Options>({
	name: 'twitter',
	description: 'Manage Twitter module',
	subcommands: [
		{
			name: 'handle',
			type: 'group',
			entries: [
				{
					name: 'add',
					chatInputRun: 'chatInputAddHandle',
				},
				{
					name: 'remove',
					chatInputRun: 'chatInputRemoveHandle',
				},
			],
		},
		{
			name: 'blacklist',
			type: 'group',
			entries: [
				{
					name: 'add',
					chatInputRun: 'chatInputBlacklistAdd',
				},
				{
					name: 'remove',
					chatInputRun: 'chatInputBlacklistRemove',
				},
			],
		},
	],
})
export class TwitterManageCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommandGroup((subcommandGroup) => subcommandGroup
					.setName('handle')
					.setDescription('Manage allowed handles')
					.addSubcommand((command) => command
						.setName('add')
						.setDescription('Add an allowed Twitter handle')
						.addStringOption((optBuilder) => optBuilder
							.setName('handle')
							.setDescription('Twitter handle (without @)')
							.setRequired(true)))
					.addSubcommand((command) => command
						.setName('remove')
						.setDescription('Add an allowed Twitter handle')
						.addStringOption((optBuilder) => optBuilder
							.setName('handle')
							.setDescription('Twitter handle (without @)')
							.setRequired(true)
							.setAutocomplete(true))))
				.addSubcommandGroup((subcommandGroup) => subcommandGroup
					.setName('blacklist')
					.setDescription('Manage blacklisted users')
					.addSubcommand((command) => command
						.setName('add')
						.setDescription('Blacklist an user from sharing posts')
						.addUserOption((optBuilder) => optBuilder
							.setName('user')
							.setDescription('User to blacklist')
							.setRequired(true)))
					.addSubcommand((command) => command
						.setName('remove')
						.setDescription('Renmove an user from the blacklist')
						.addUserOption((optBuilder) => optBuilder
							.setName('user')
							.setDescription('User to blacklist')
							.setRequired(true))));
		}, {
			guildIds: this.container.config.twitter.managementGuilds ?? [],
		});
	}

	public async chatInputAddHandle(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true).toLowerCase();

		await interaction.deferReply();

		try {
			const exists = await this.container.meiliClient.index('twitter-users').getDocument(handle);
			if (exists) {
				await interaction.editReply('This user has already been added.');
				return;
			}
		} catch { /* */ }

		await this.container.meiliClient.index('twitter-users').addDocuments([
			{
				handle,
			},
		]);
		await interaction.editReply('User has been successfully added.');
	}

	public async chatInputRemoveHandle(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true).toLowerCase();

		await interaction.deferReply();

		try {
			await this.container.meiliClient.index('twitter-users').getDocument(handle);
		} catch {
			await interaction.editReply('Could not find this user.');
			return;
		}

		await this.container.meiliClient.index('twitter-users').deleteDocument(handle);
		await this.container.db.twitterSubscription.deleteMany({
			where: {
				handle,
			},
		});
		await interaction.editReply('User has been successfully removed.');
	}

	public async chatInputBlacklistAdd(interaction: Subcommand.ChatInputCommandInteraction) {
		const user = interaction.options.getUser('user', true);

		await interaction.deferReply();

		const existing = await this.container.db.twitterBlacklist.findUnique({
			where: {
				id: user.id,
			},
		});

		if (existing) {
			await interaction.editReply('This user is already blacklisted.');
			return;
		}

		await this.container.db.twitterBlacklist.create({
			data: {
				id: user.id,
			},
		});
		await interaction.editReply('This user has been blacklisted.');
	}

	public async chatInputBlacklistRemove(interaction: Subcommand.ChatInputCommandInteraction) {
		const user = interaction.options.getUser('user', true);

		await interaction.deferReply();

		const existing = await this.container.db.twitterBlacklist.findUnique({
			where: {
				id: user.id,
			},
		});

		if (!existing) {
			await interaction.editReply('This user is not blacklisted.');
			return;
		}

		await this.container.db.twitterBlacklist.delete({
			where: {
				id: user.id,
			},
		});
		await interaction.editReply('This user has been removed from the blacklist.');
		//
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		const focusedOption = interaction.options.getFocused(true);

		if (focusedOption.name === 'handle') {
			const searchResult = await this.container.meiliClient.index('twitter-users').search<{ handle: string }>(focusedOption.value, {
				limit: 25,
			});
			await interaction.respond(searchResult.hits.map((result) => ({
				name: result.handle,
				value: result.handle,
			})));
		}
	}
}
