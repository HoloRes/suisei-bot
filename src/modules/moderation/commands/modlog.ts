import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities';

@ApplyOptions<Command.Options>({
	name: 'modlog',
	description: 'Fetch the mod log of an user',
})
export class ModLogCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to check')
				.setRequired(true))
			.addBooleanOption((optBuilder) => optBuilder
				.setName('crosscheck')
				.setDescription('Also list cases from other servers')
				.setRequired(true)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		const crosscheck = interaction.options.getBoolean('crosscheck', true);

		await interaction.deferReply();

		const logs = await this.container.db.moderationLogItem.findMany({
			where: {
				offenderId: user.id,
				guildId: crosscheck ? undefined : interaction.guildId,
			},
		});

		if (logs.length === 0) {
			await interaction.editReply('No logs found for that user.');
			return;
		}

		await interaction.editReply({
			embeds: [
				new EmbedBuilder({
					title: `Modlog for ${user.tag}`,
					timestamp: Date.now(),
					color: 0x61cdff,
				}),
			],
		});
		const msg = await interaction.fetchReply();

		await new PaginatedMessageEmbedFields()
			.setTemplate({
				title: `Modlog for ${user.tag}`,
				timestamp: Date.now(),
				color: 0x61cdff,
			})
			.setItems(logs.map((logItem) => ({
				name: `#${logItem.id} (${logItem.action.toLowerCase()})${logItem.guildId !== interaction.guildId ? ` - in ${logItem.guildId}` : ''}`,
				value: logItem.reason,
				inline: true,
			})))
			.setItemsPerPage(8)
			.make()
			.run(msg);
	}
}
