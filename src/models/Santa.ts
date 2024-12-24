import { DocumentType, getModelForClass, prop } from '@typegoose/typegoose'
import { Restriction as RealRestriction } from '../restrictions'

class Restriction implements RealRestriction {
    @prop({ required: true, enum: ['score', 'episodes', 'duration', 'full_duration'] })
    type!: 'score' | 'episodes' | 'duration' | 'full_duration'
    @prop({ required: true, enum: ['>', '<'] })
    operator!: '>' | '<'
    @prop({ required: true })
    value!: number
}

class Santa {
    @prop({ required: true })
    creator!: number

    @prop({ required: true })
    name!: string

    @prop({ required: true })
    startDate!: Date

    @prop({ required: true })
    selectDate!: Date

    @prop({ required: true })
    deadlineDate!: Date

    @prop({ required: true })
    rules!: number

    @prop()
    chat?: number

    @prop({ required: true, type: () => [Restriction], _id: false })
    restrictions!: Restriction[]

    @prop({ required: true, type: () => Boolean })
    options!: Map<string, boolean>

    @prop({ required: true, type: () => String })
    pairing!: Map<string, string>
}

export const SantaModel = getModelForClass(Santa)
export type SantaDocument = DocumentType<typeof Santa>
