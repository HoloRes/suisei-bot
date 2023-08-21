import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'twitterleaderboard',
	description: 'Twitter sharing leaderboard',
})
export class TwitterCommand extends Command {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((optBuilder) => optBuilder
					.setName('duration')
					.setDescription('Choose the duration the leaderboard should show')
					.setChoices(
						{
							name: 'Month',
							value: 'month',
						},
						{
							name: 'All time',
							value: 'alltime',
						},
					));
		});
	}

	public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const duration = interaction.options.getString('duration') ?? 'alltime';

		await interaction.deferReply();

		const leaders = await this.container.db.twitterLeaderboardUser.findMany({
			where: (
				duration === 'alltime'
					? ({ totalShares: { gte: 1 } })
					: ({ sharesThisMonth: { gte: 1 } })
			),
			orderBy: (
				duration === 'alltime'
					? ({ totalShares: 'desc' })
					: ({ sharesThisMonth: 'desc' })
			),
			take: 25,
		});

		if (leaders.length === 0) {
			await interaction.editReply("There's no one on the leaderboard right now!");
			return;
		}

		const lines: string[] = [];
		const tasks = leaders
			.map(async (user, index) => {
				const discordUser = await this.container.client.users.fetch(user.id);

				lines[index] = `${index + 1}. ${discordUser.tag}: ${duration === 'alltime' ? user.totalShares : user.sharesThisMonth} shares`;
			});

		await Promise.all(tasks);

		const embed = new EmbedBuilder()
			.setTitle(`${duration === 'alltime' ? 'All time' : 'Monthly'} Twitter sharing leaderboard`)
			.setDescription(
				lines.join('\n'),
			)
			.setTimestamp();

		await interaction.editReply({
			embeds: [embed],
		});
	}
}
