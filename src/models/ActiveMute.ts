// Packages
import mongoose, { Schema, Document } from 'mongoose';

export interface IActiveMute {
	id: string,
	guild: string,
	userId: string,
	expireAt: Date,
	leftAt?: Date,
	hardMute?: boolean,
	roles?: string[]
}

export interface IActiveMuteDocument extends IActiveMute, Document {
	id: string,
}

const ActiveMuteSchema: Schema = new Schema({
	id: { type: String, required: true },
	guild: { type: String, required: true },
	userId: { type: String, required: true },
	expireAt: { type: Date, required: true },
	leftAt: Date,
	hardMute: { type: Boolean, default: false },
	roles: { type: [String], default: undefined },
});

export default mongoose.model<IActiveMuteDocument>('ModLogItem', ActiveMuteSchema, 'activeMutes');
