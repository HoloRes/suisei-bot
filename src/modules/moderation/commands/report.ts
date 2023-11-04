import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ActionRowBuilder,
	ComponentType,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js';
import { UserReportType } from '@holores/bansapi.js/dist/types';

@ApplyOptions<Command.Options>({
	name: 'report',
	description: 'Report an user for crossbanning',
	preconditions: ['ValidModerationConfig'],
})
export class ReportCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder
			.setName(this.name)
			.setDescription(this.description)
			.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
			.addUserOption((optBuilder) => optBuilder
				.setName('user')
				.setDescription('User to report')
				.setRequired(true))
			.addStringOption((optBuilder) => optBuilder
				.setName('reason')
				.setDescription('Reason for the report')
				.setRequired(true)
				.setMaxLength(1000)));
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply('This command cannot run outside a guild');
			return;
		}

		const user = interaction.options.getUser('user', true);
		const reason = interaction.options.getString('reason', true);

		const typeSelect = new StringSelectMenuBuilder()
			.setCustomId('type')
			.setPlaceholder('Choose a report type')
			.addOptions(
				new StringSelectMenuOptionBuilder()
					.setValue('NORMAL')
					.setLabel('Normal')
					.setDescription('A normal ban'),
				new StringSelectMenuOptionBuilder()
					.setValue('COMPROMISED')
					.setLabel('Compromised')
					.setDescription('A compromised account'),
			);

		const row = new ActionRowBuilder<StringSelectMenuBuilder>()
			.addComponents(typeSelect);

		const followUp = await interaction.reply({
			components: [row],
		});

		let type;
		try {
			type = await followUp.awaitMessageComponent({
				componentType: ComponentType.StringSelect,
				time: 900_000,
			});
		} catch {
			await followUp.edit({ content: 'Confirmation not received within 15 minutes, cancelling', components: [] });
			return;
		}

		const report = await this.container.bansApi.users.create({
			userId: user.id,
			moderatorId: interaction.user.id,
			reason,
			type: type.values[0] as UserReportType,
		});

		await this.container.retracedClient.reportEvent({
			action: 'moderation.crossreport.user',
			group: {
				id: interaction.guildId,
				name: interaction.guild!.name,
			},
			crud: 'c',
			actor: {
				id: interaction.user.id,
				name: interaction.user.tag,
			},
			target: {
				id: user.id,
				type: 'User',
			},
			fields: {
				reportId: report.id.toString(),
			},
		});

		await interaction.editReply({
			content: `Successfully reported, id: ${report.id}`,
			components: [],
		});
	}
}
