import { DocumentType, getModelForClass, prop } from "@typegoose/typegoose";

class Santa {
    @prop({ required: true })
    creator!: number

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

    @prop({ required: true, type: () => Boolean })
    options!: Map<string, boolean>
}

export const SantaModel = getModelForClass(Santa)
export type SantaDocument = DocumentType<typeof Santa>