// Packages
import mongoose, { Schema, Document } from 'mongoose';

// Types
import { IConfig } from '../types';

// Local files
const config: IConfig = require('../../config');

interface IStrikeSeverity {
	type: 'warn' | 'mute' | 'kick' | 'tempban' | 'ban',
	duration?: number
}

export interface IGuild extends Document {
	_id: string,
	settings: {
		prefix: string,
		slashCommandsEnabled: {
			enabled: boolean,
			allowedRoles: string[],
			allowedUsers: string[],
		},
		moderation: {
			strikeSystem: IStrikeSeverity[],
			muteRole: string,
		},
		enabledModules: string[],
	},
	setupDone: boolean,
}

const StrikeSeverity: Schema = new Schema({
	type: { type: String, required: true },
	duration: Number,
});

const GuildSchema: Schema = new Schema({
	_id: { type: String, required: true },
	settings: {
		prefix: { type: String, default: config.discord.defaultPrefix },
		slashCommands: {
			enabled: { type: Boolean, default: false },
			allowedRoles: [String],
			allowedUsers: [String],
		},
		moderation: {
			strikeSystem: {
				type: [StrikeSeverity],
				default: [
					{
						type: 'mute',
						duration: 24 * 3600 * 1000,
					},
					{
						type: 'mute',
						duration: 7 * 24 * 3600 * 1000,
					},
					{
						type: 'ban',
					},
				],
			},
			muteRole: String,
		},
		enabledModules: [String],
	},
	setupDone: { type: Boolean, default: false },
});

export default mongoose.model<IGuild>('Guild', GuildSchema, 'guilds');
