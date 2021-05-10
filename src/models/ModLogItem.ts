// Packages
import mongoose, { Schema, Document } from 'mongoose';

export interface IModLogItem {
	id: string,
	guild: string,
	userId: string,
	type: 'warn' | 'unmute' | 'mute' | 'hardmute' | 'kick' | 'tempban' | 'ban',
	duration?: string,
	moderator: string,
	reason: string,
	date?: Date,
}

export interface IModLogItemDocument extends IModLogItem, Document {
	id: string,
}

const ModLogSchema: Schema = new Schema({
	id: { type: String, required: true },
	guild: { type: String, required: true },
	userId: { type: String, required: true },
	type: { type: String, required: true, enum: ['warn', 'unmute', 'mute', 'kick', 'ban'] },
	duration: { type: String },
	moderator: { type: String, required: true },
	reason: { type: String, required: true },
	date: { type: Date, default: new Date() },
});

export default mongoose.model<IModLogItemDocument>('ModLogItem', ModLogSchema, 'modLog');
