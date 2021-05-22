// Packages
import Discord from 'discord.js';

// Local files
import { client } from '../index';

// eslint-disable-next-line consistent-return,max-len
async function getMember(message: Discord.Message, arg: string): Promise<Discord.GuildMember | undefined> {
	await message.guild?.members.fetch();

	if (message.mentions.members && message.mentions.members?.size > 0) {
		return message.mentions.members?.first();
	}

	const foundMember = message.guild?.members.cache.find((member) => new RegExp(arg, 'gi').test(member.user.username));
	if (foundMember) return foundMember;

	const fetchedMember = await message.guild?.members.fetch(arg)
		.catch(() => undefined);
	if (fetchedMember) return fetchedMember;
}

// eslint-disable-next-line consistent-return,max-len
async function getChannel(message: Discord.Message, arg: string): Promise<Discord.Channel | undefined> {
	if (message.mentions.channels && message.mentions.channels?.size > 0) {
		return message.mentions.channels?.first();
	}

	const foundChannel = message.guild?.channels.cache.find((channel) => new RegExp(arg, 'gi').test(channel.name));
	if (foundChannel) return foundChannel;

	const fetchedChannel = await client.channels.fetch(arg)
		.catch(() => undefined);
	if (fetchedChannel) return <Discord.GuildChannel>fetchedChannel;
}

// eslint-disable-next-line consistent-return
async function getRole(message: Discord.Message, arg: string): Promise<Discord.Role | undefined> {
	await message.guild?.roles.fetch();

	if (message.mentions.roles && message.mentions.roles?.size > 0) {
		return message.mentions.roles?.first();
	}

	const foundRole = message.guild?.roles.cache.find((role) => new RegExp(arg, 'gi').test(role.name));
	if (foundRole) return foundRole;

	const fetchedRole = await message.guild?.roles.fetch(arg)
		.catch(() => undefined);
	if (fetchedRole) return fetchedRole;
}

export default {
	getChannel,
	getMember,
	getRole,
};
