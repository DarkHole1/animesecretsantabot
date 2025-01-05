import { Bot, Context, session, SessionFlavor } from 'grammy'
import { readFileSync } from 'fs'
import toml, { JsonMap } from '@iarna/toml'
import { Router } from '@grammyjs/router'
import {
    compareAsc,
    differenceInDays,
    parse,
    startOfToday,
    startOfYesterday,
} from 'date-fns'
import {
    checkShikimoriRestrictions,
    parseRestrictions,
    Restriction,
} from './restrictions'
import { SantaModel } from './models/Santa'
import mongoose from 'mongoose'
import { ParticipantModel, ParticipantStatus } from './models/Participant'
import { CronJob } from 'cron'
import shuffle from 'lodash.shuffle'
import { CommandGroup } from '@grammyjs/commands'
import { I18n, I18nFlavor } from '@grammyjs/i18n'
import { autoRetry } from '@grammyjs/auto-retry'

type SessionData = {
    state:
        | 'start'
        | 'create-name'
        | 'create-start-date'
        | 'create-select-date'
        | 'create-deadline-date'
        | 'create-chat'
        | 'create-rules'
        | 'create-restrictions'
        | 'create-additional-options'
        | 'participate-info'
        | 'participate-options'
        | 'participate-select-title'
        | 'participate-write-review'
    name?: string
    startDate?: Date
    selectDate?: Date
    deadlineDate?: Date
    chatId?: number
    rulesId?: number
    restrictions?: Restriction[]

    santaId?: string
    participantId?: string
    infoId?: number

    options?: Map<string, boolean>
}

type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor

const config = toml.parse(readFileSync('config.toml', 'utf-8'))
const bot = new Bot<MyContext>((config.Telegram as JsonMap).token as string)
const superAdminId = (config.Telegram as JsonMap).super_admin_id as number

bot.catch(async (err) => {
    const ctx = err.ctx
    try {
        await ctx.api.sendMessage(
            superAdminId,
            `Error: ${err.toString()}\n${err.stack}`
        )
    } catch (e) {
        console.log(e)
    }
})

mongoose.connect((config.MongoDB as JsonMap).uri as string)

bot.use(session({ initial: (): SessionData => ({ state: 'start' }) }))
// TODO: Save locale for user
const i18n = new I18n({
    defaultLocale: 'ru',
    directory: 'locales',
})
bot.use(i18n)
bot.api.config.use(autoRetry())

bot.command('start', async (ctx) => {
    if (ctx.match) {
        const santa = await SantaModel.findById(ctx.match)
        if (!santa) {
            await ctx.reply(ctx.t(`santa-not-found-error`))
            return
        }
        if (compareAsc(santa.startDate, new Date()) <= 0) {
            await ctx.reply(ctx.t(`santa-started-error`))
            return
        }
        if (
            await ParticipantModel.findOne({
                user: ctx.msg.from!.id,
                santa: santa.id,
            })
        ) {
            await ctx.reply(ctx.t(`already-registered-error`))
            return
        }
        await ctx.api.copyMessage(ctx.chatId, santa.creator, santa.rules)
        await ctx.reply(ctx.t(`write-wish`))
        ctx.session.santaId = ctx.match
        ctx.session.state = 'participate-info'
    } else {
        await ctx.reply(ctx.t(`welcome-message`))
    }
})

bot.command('new', async (ctx) => {
    await ctx.reply(ctx.t(`choose-name`))
    ctx.session.state = 'create-name'
})

bot.command('my', async (ctx) => {
    const created = await SantaModel.find({ creator: ctx.from!.id })
    const participated = await ParticipantModel.find({
        user: ctx.from!.id,
        $or: [
            { status: ParticipantStatus.APPROVED },
            { status: ParticipantStatus.WATCHING },
        ],
    })

    await ctx.reply(
        ctx.t(`santas-of-user`, {
            created: created
                .map((santa) => `${santa.name} /my${santa.id}`)
                .join('\n'),
            selecting: participated
                .filter((p) => p.status == ParticipantStatus.APPROVED)
                .map((p) => `/choose${p.santa}`)
                .join('\n'),
            reviewing: participated
                .filter((p) => p.status == ParticipantStatus.WATCHING)
                .map((p) => `/review${p.santa}`)
                .join('\n'),
        })
    )
})

bot.command('cancel', (ctx) => {
    ctx.session.state = 'start'
})

const commands = new CommandGroup<MyContext>()

commands.command(/my(.+)/, 'My santa', async (ctx) => {
    const id = ctx.msg.text.slice('/my'.length)
    const santa = await SantaModel.findById(id)
    if (!santa) {
        await ctx.reply(ctx.t(`general-error`))
        return
    }
    const totalParticipants = await ParticipantModel.countDocuments({
        santa: id,
        status: {
            $in: [
                ParticipantStatus.APPROVED,
                ParticipantStatus.WATCHING,
                ParticipantStatus.COMPLETED,
            ],
        },
    })
    const waitingParticipants = await ParticipantModel.countDocuments({
        santa: id,
        status: ParticipantStatus.WAITING,
    })
    const titleSelectedParticipants = await ParticipantModel.countDocuments({
        santa: id,
        choice: { $exists: true },
    })
    const reviewedParticipants = await ParticipantModel.countDocuments({
        santa: id,
        status: ParticipantStatus.COMPLETED,
    })

    await ctx.reply(
        ctx.t(`santa-info`, {
            title: santa.name,
            startDate: santa.startDate,
            selectDate: santa.selectDate,
            deadlineDate: santa.deadlineDate,
            chatId: santa.chat ?? '',
            totalParticipants,
            waitingParticipants,
            titleSelectedParticipants,
            reviewedParticipants,
        })
    )
})

commands.command(/choose(.+)/, 'Choose anime', async (ctx) => {
    const id = ctx.msg.text.slice('/choose'.length)
    const santa = await SantaModel.findById(id)
    const participant = await ParticipantModel.findOne({
        santa: id,
        user: ctx.from!.id,
        status: ParticipantStatus.APPROVED,
    })

    if (!santa || !participant) {
        await ctx.reply(ctx.t(`general-error`))
        return
    }

    const to = santa.pairing.get(participant.id)
    if (!to) {
        await ctx.reply(ctx.t(`general-error`))
        return
    }

    const toFound = await ParticipantModel.findById(to)
    if (!toFound) {
        await ctx.reply(ctx.t(`general-error`))
        return
    }

    ctx.session.santaId = id
    ctx.session.participantId = participant.id
    ctx.session.state = 'participate-select-title'
    await ctx.reply(ctx.t(`select-title`))
    await ctx.api.forwardMessage(ctx.msg.from!.id, toFound.user, toFound.info)
})

commands.command(/review(.+)/, 'Review anime', async (ctx) => {
    const id = ctx.msg.text.slice('/review'.length)
    const participant = await ParticipantModel.findOne({
        santa: id,
        user: ctx.from!.id,
        status: ParticipantStatus.WATCHING,
    })

    if (!participant) {
        await ctx.reply(ctx.t(`not-a-participant-error`))
        return
    }

    ctx.session.santaId = id
    ctx.session.participantId = participant.id
    ctx.session.state = 'participate-write-review'
    await ctx.reply(ctx.t(`write-review`))
})

bot.use(commands)

const router = new Router<MyContext>((ctx) => ctx.session.state)

router.route('create-name').on('message:text', async (ctx) => {
    await ctx.reply(ctx.t(`choose-start-date`))
    ctx.session.name = ctx.message.text
    ctx.session.state = 'create-start-date'
})

router.route('create-start-date').on('message:text', async (ctx) => {
    const res = parse(ctx.msg.text, `dd.MM.yyyy`, new Date())
    if (isNaN(res.valueOf())) {
        await ctx.reply(ctx.t(`parse-date-error`))
        return
    }
    const diff = differenceInDays(res, new Date())
    // if (diff < 2 || diff > 31) {
    //     await ctx.reply(ctx.t(`invalid-date-error`))
    //     return
    // }
    await ctx.reply(ctx.t(`choose-select-date`))
    ctx.session.startDate = res
    ctx.session.state = 'create-select-date'
})

router.route('create-select-date').on('message:text', async (ctx) => {
    const res = parse(ctx.msg.text, `dd.MM.yyyy`, new Date())
    if (isNaN(res.valueOf())) {
        await ctx.reply(ctx.t(`parse-date-error`))
        return
    }
    if (!ctx.session.startDate) {
        await ctx.reply(ctx.t(`time-travel-error`))
        await ctx.reply(ctx.t(`choose-start-date`))
        ctx.session.state = 'create-start-date'
        return
    }
    const diff = differenceInDays(res, ctx.session.startDate)
    if (diff < 2 || diff > 31) {
        await ctx.reply(ctx.t(`invalid-date-error`))
        return
    }
    await ctx.reply(ctx.t(`choose-deadline-date`))
    ctx.session.selectDate = res
    ctx.session.state = 'create-deadline-date'
})

router.route('create-deadline-date').on('message:text', async (ctx) => {
    const res = parse(ctx.msg.text, `dd.MM.yyyy`, new Date())
    if (isNaN(res.valueOf())) {
        await ctx.reply(ctx.t(`parse-date-error`))
        return
    }
    if (!ctx.session.selectDate) {
        await ctx.reply(ctx.t(`time-travel-error`))
        await ctx.reply(ctx.t(`choose-select-date`))
        ctx.session.state = 'create-select-date'
        return
    }
    const diff = differenceInDays(res, ctx.session.selectDate)
    if (diff < 2 || diff > 31) {
        await ctx.reply(ctx.t(`invalid-date-error`))
        return
    }

    await ctx.reply(ctx.t(`choose-chat`), {
        reply_markup: {
            one_time_keyboard: true,
            is_persistent: true,
            resize_keyboard: true,
            keyboard: [
                [
                    {
                        text: ctx.t(`choose-chat.button`),
                        request_chat: {
                            request_id: Math.floor(Math.random() * 1000),
                            chat_is_channel: false,
                            bot_is_member: true,
                        },
                    },
                ],
            ],
        },
    })
    ctx.session.deadlineDate = res
    ctx.session.state = 'create-chat'
})

router.route('create-chat').on(':chat_shared', async (ctx) => {
    await ctx.reply(ctx.t(`write-rules`), {
        reply_markup: {
            remove_keyboard: true,
        },
    })
    ctx.session.chatId = ctx.msg.chat_shared.chat_id
    ctx.session.state = 'create-rules'
})

router.route('create-rules').on('message:text', async (ctx) => {
    const rulesId = ctx.msg.message_id
    await ctx.reply(ctx.t(`write-restrictions`))
    ctx.session.rulesId = rulesId
    ctx.session.state = 'create-restrictions'
})

router.route('create-restrictions').on('message:text', async (ctx) => {
    const restrictions = parseRestrictions(ctx.msg.text)
    if (!restrictions) {
        await ctx.reply(ctx.t(`parse-restrictions-error`))
        return
    }
    await ctx.reply(ctx.t(`choose-create-options`))
    ctx.session.restrictions = restrictions
    ctx.session.state = 'create-additional-options'
})

router.route('create-additional-options').command('next', async (ctx) => {
    // TODO: Add parsing options
    ctx.session.options = new Map()
    // TODO: Validate
    const santa = new SantaModel({
        chat: ctx.session.chatId,
        creator: ctx.chatId,
        name: ctx.session.name,
        deadlineDate: ctx.session.deadlineDate,
        selectDate: ctx.session.selectDate,
        startDate: ctx.session.startDate,
        rules: ctx.session.rulesId,
        restrictions: ctx.session.restrictions,
        options: ctx.session.options,
        pairing: new Map(),
    })
    await santa.save()
    await ctx.reply(
        ctx.t(`santa-created`, {
            link: `https://t.me/${ctx.me.username}?start=${santa.id}`,
        })
    )
    ctx.session.state = 'start'
})

router.route('participate-info').on('message:text', async (ctx) => {
    await ctx.reply(ctx.t(`choose-participate-options`))
    ctx.session.infoId = ctx.msg.message_id
    ctx.session.options = new Map()
    ctx.session.state = 'participate-options'
})

router.route('participate-options').command('next', async (ctx) => {
    // TODO: Validate
    const santa = await SantaModel.findById(ctx.session.santaId)
    if (!santa) {
        await ctx.reply(ctx.t(`general-error`))
        ctx.session.state = 'start'
        return
    }
    const participant = new ParticipantModel({
        santa: ctx.session.santaId,
        user: ctx.from!.id,
        info: ctx.session.infoId,
        approved: ParticipantStatus.WAITING,
        options: ctx.session.options,
    })
    await participant.save()
    await ctx.api.sendMessage(
        santa.creator,
        ctx.t(`new-request`, {
            name: [ctx.from!.first_name, ctx.from!.last_name]
                .filter(Boolean)
                .join(' '),
            username: `@${ctx.from!.username}`,
        }),
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: ctx.t(`new-request.accept`),
                            callback_data: `accept:${santa.id}:${ctx.from!.id}`,
                        },
                        {
                            text: ctx.t(`new-request.reject`),
                            callback_data: `reject:${santa.id}:${ctx.from!.id}`,
                        },
                    ],
                ],
            },
        }
    )
    await ctx.reply(ctx.t(`request-sent`))
    ctx.session.state = 'start'
})

router.route('participate-select-title').on('message', async (ctx) => {
    const links = ctx.entities().flatMap((link) => {
        if (link.type == 'text_link') {
            return [link.url]
        }
        if (link.type == 'url') {
            return [link.text]
        }
        return []
    })
    const animeLinks = links.flatMap((link) => {
        const match = link.match(
            /(?:https:\/\/)?shikimori\.(?:one|me)\/animes\/[^\d]*(\d+)/
        )
        if (!match) return []
        return parseInt(match[1])
    })
    if (animeLinks.length <= 0) {
        ctx.reply(ctx.t(`anime-link-not-found`))
        return
    }
    if (animeLinks.length > 1) {
        ctx.reply(ctx.t(`too-many-links-error`))
        return
    }
    const shikimoriLink = animeLinks[0]
    const santa = await SantaModel.findById(ctx.session.santaId)
    if (!santa) {
        console.log(`Santa not found`, ctx.session)
        ctx.reply(ctx.t(`general-error`))
        ctx.session.state = 'start'
        return
    }
    const valid = await checkShikimoriRestrictions(
        shikimoriLink,
        santa.restrictions
    )
    if (!valid) {
        await ctx.reply(ctx.t(`restrictions-check-failed`))
        return
    }

    const participant = await ParticipantModel.findOne({
        user: ctx.from.id,
        santa: ctx.session.santaId,
    })
    if (!participant) {
        console.log(`Participant not found`, ctx.session)
        ctx.reply(ctx.t(`general-error`))
        return
    }
    participant.choice = `https://shikimori.one/animes/${shikimoriLink}`
    await participant.save()
    await ctx.reply(ctx.t(`select-title-success`))
    ctx.session.state = 'start'
})

router.route('participate-write-review').on('message:text', async (ctx) => {
    if (ctx.msg.text.split(/\s+/).length < 50) {
        await ctx.reply(ctx.t(`review-check-failed`))
        return
    }
    const santa = await SantaModel.findById(ctx.session.santaId)
    const participant = await ParticipantModel.findOne({
        user: ctx.msg.from.id,
        santa: ctx.session.santaId,
    })
    if (!participant || !santa) {
        await ctx.reply(ctx.t(`general-error`))
        ctx.session.state = 'start'
        return
    }
    await ctx.forwardMessage(santa.chat ?? santa.creator)

    participant.status = ParticipantStatus.COMPLETED
    await participant.save()
    await ctx.reply(ctx.t(`write-review-success`))
    ctx.session.state = 'start'
})

bot.callbackQuery(/^(accept|reject):(.+?):(.+?)$/, async (ctx) => {
    const match = ctx.match as RegExpMatchArray
    const choice = match[1]
    const santaId = match[2]
    const userId = match[3]

    const participant = await ParticipantModel.findOne({
        user: userId,
        santa: santaId,
    })

    if (!participant) {
        await ctx.answerCallbackQuery(ctx.t(`participant-not-found.short`))
        return
    }

    if (choice == 'accept') {
        participant.status = ParticipantStatus.APPROVED
    } else {
        participant.status = ParticipantStatus.REJECTED
    }

    await participant.save()
    await ctx.api.sendMessage(
        participant.user,
        ctx.t(`request-answer`, {
            status: choice,
        })
    )
    await ctx.answerCallbackQuery(ctx.t(`request-answer.success`))
})

bot.use(router)

const job = CronJob.from({
    cronTime: '30 15 * * *',
    onTick: async () => {
        try {
            const today = startOfToday()
            const yesterday = startOfYesterday()
            const started = await SantaModel.find({ startDate: today })
            // TODO: Add reminders
            const selectedReminder = await SantaModel.find({
                selectDate: yesterday,
            })
            const selected = await SantaModel.find({ selectDate: today })
            const deadlined = await SantaModel.find({ deadlineDate: today })

            for (const startedSanta of started) {
                // TODO: Send waiting messages
                const participants = await ParticipantModel.find({
                    santa: startedSanta.id,
                    status: ParticipantStatus.APPROVED,
                })
                if (participants.length < 2) {
                    await bot.api.sendMessage(
                        startedSanta.creator,
                        i18n.t(`ru`, `not-enough-participants`)
                    )
                    await startedSanta.deleteOne()
                    continue
                }
                const shuffledParticipants = shuffle(participants)
                const pairing = new Map<string, string>()
                for (let i = 0; i < shuffledParticipants.length; i++) {
                    const current = shuffledParticipants[i]
                    const next = shuffledParticipants[(i + 1) % shuffledParticipants.length]
                    pairing.set(current.id!.toString(), next.id!.toString())
                }
                startedSanta.pairing = pairing
                await startedSanta.save()
                for (let i = 0; i < shuffledParticipants.length; i++) {
                    const current = participants[i]
                    const next = participants[(i + 1) % participants.length]
                    await bot.api.sendMessage(
                        current.user,
                        i18n.t(`ru`, `ward-selected`, {
                            command: `/choose${startedSanta.id}`,
                        })
                    )
                    await bot.api.copyMessage(
                        current.user,
                        next.user,
                        next.info
                    )
                }
            }

            for (const selectedReminderSanta of selectedReminder) {
                const participants = await ParticipantModel.find({
                    santa: selectedReminderSanta.id,
                    status: ParticipantStatus.APPROVED,
                    choice: { $exists: false },
                })

                for (const participant of participants) {
                    await bot.api.sendMessage(
                        participant.user,
                        i18n.t(`ru`, `selected-reminder`)
                    )
                }
            }

            for (const selectedSanta of selected) {
                // TODO: Send warning messages to whom not selected
                const participants = await ParticipantModel.find({
                    santa: selectedSanta.id,
                    status: ParticipantStatus.APPROVED,
                    choice: { $exists: true },
                })

                for (const participant of participants) {
                    const to = await ParticipantModel.findById(
                        selectedSanta.pairing.get(participant.id!.toString())
                    )
                    if (!to) {
                        await bot.api.sendMessage(
                            superAdminId,
                            i18n.t(`ru`, `general-error`)
                        )
                        continue
                    }
                    await bot.api.sendMessage(
                        to.user,
                        i18n.t(`ru`, `title-selected`, {
                            link: participant.choice!,
                            deadline: selectedSanta.deadlineDate,
                        })
                    )
                    to.status = ParticipantStatus.WATCHING
                    await to.save()
                }
            }

            for (const deadlineSanta of deadlined) {
                // TODO: Warn participants
                const participants = await ParticipantModel.find({
                    santa: deadlineSanta.id,
                    status: ParticipantStatus.WATCHING,
                })

                await bot.api.sendMessage(
                    deadlineSanta.chat ?? deadlineSanta.creator,
                    i18n.t(`ru`, `santa-ended`, {
                        badUsers: participants.length,
                    })
                )
            }
        } catch (e) {
            console.log(e)
            await bot.api.sendMessage(superAdminId, i18n.t(`ru`, `santa-ended`))
        }
    },
})

job.start()
bot.start()
