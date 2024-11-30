import { DocumentType, getModelForClass, prop } from "@typegoose/typegoose";
import mongoose from "mongoose";

class Participant {
    @prop({ required: true })
    santa!: mongoose.Types.ObjectId

    @prop({ required: true })
    user!: number

    @prop({ required: true })
    info!: number

    @prop({ required: true, type: () => Boolean })
    options!: Map<string, boolean>
}

export const ParticipantModel = getModelForClass(Participant)
export type ParticipantDocument = DocumentType<typeof Participant>