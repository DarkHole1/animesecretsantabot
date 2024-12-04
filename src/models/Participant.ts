import { DocumentType, getModelForClass, prop } from '@typegoose/typegoose'
import mongoose from 'mongoose'

export enum ParticipantStatus {
    WAITING = 'waiting',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

class Participant {
    @prop({ required: true })
    santa!: mongoose.Types.ObjectId

    @prop({ required: true })
    user!: number

    @prop({ required: true })
    info!: number

    @prop({
        required: true,
        default: ParticipantStatus.WAITING,
        enum: ParticipantStatus,
    })
    approved!: ParticipantStatus

    @prop({ required: true, type: () => Boolean })
    options!: Map<string, boolean>

    @prop()
    choice?: string
}

export const ParticipantModel = getModelForClass(Participant)
export type ParticipantDocument = DocumentType<typeof Participant>
