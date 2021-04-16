// Packages
import mongoose, { Schema, Document } from 'mongoose';

// Types
import { IConfig } from '../types';

// Local files
const config: IConfig = require('../../config');

export interface IGuild extends Document {
	_id: string,
	settings: {
		prefix: string,
		slashCommandsEnabled: {
			enabled: boolean,
			allowedRoles: string[],
			allowedUsers: string[],
		},
		enabledModules: string[],
	},
	setupDone: boolean,
}

const GuildSchema: Schema = new Schema({
	_id: { type: String, required: true },
	settings: {
		prefix: { type: String, default: config.discord.defaultPrefix },
		slashCommands: {
			enabled: { type: Boolean, default: false },
			allowedRoles: [String],
			allowedUsers: [String],
		},
		enabledModules: [String],
	},
	setupDone: { type: Boolean, default: false },
});

export default mongoose.model<IGuild>('Guild', GuildSchema, 'guilds');
