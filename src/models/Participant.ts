import { DocumentType, getModelForClass, prop } from "@typegoose/typegoose";
import { ObjectId } from "mongoose";

class Participant {
    @prop({ required: true })
    santaId!: ObjectId

    @prop({ required: true })
    userId!: number

    @prop({ required: true })
    messageId!: number

    @prop({ required: true, type: () => Boolean })
    options!: Map<string, boolean>
}

export const ParticipantModel = getModelForClass(Participant)
export type ParticipantDocument = DocumentType<typeof Participant>