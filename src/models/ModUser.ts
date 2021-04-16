// Packages
import mongoose, { Schema, Document } from 'mongoose';

export interface IModUser extends Document {
    _id: string
}

const ModUserSchema: Schema = new Schema({
	_id: { type: String, required: true },
	lastKnownTag: { type: String, required: true },
	notes: Object,
});

export default mongoose.model<IModUser>('ModUser', ModUserSchema, 'modUsers');
