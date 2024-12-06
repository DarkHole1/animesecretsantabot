import { Bot, Context, session, SessionFlavor } from 'grammy'
import { link, readFileSync } from 'fs'
import toml, { JsonMap } from '@iarna/toml'
import { Router } from '@grammyjs/router'
import * as text from './text'
import { differenceInDays, parse, startOfDay } from 'date-fns'
import {
    checkShikimoriRestrictions,
    parseRestrictions,
    Restriction,
} from './restrictions'
import { SantaModel } from './models/Santa'
import mongoose from 'mongoose'
import { ParticipantModel, ParticipantStatus } from './models/Participant'
import { CronJob } from 'cron'
import _ from 'underscore'
import { CommandGroup } from '@grammyjs/commands'

type SessionData = {
    state:
        | 'start'
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
    startDate?: Date
    selectDate?: Date
    deadlineDate?: Date
    chatId?: number
    rulesId?: number
    restrictions?: Restriction[]

    santaId?: string
    infoId?: number

    options?: Map<string, boolean>
}

type MyContext = Context & SessionFlavor<SessionData>

const config = toml.parse(readFileSync('config.toml', 'utf-8'))
const bot = new Bot<MyContext>((config.Telegram as JsonMap).token as string)

mongoose.connect((config.MongoDB as JsonMap).uri as string)

bot.use(session({ initial: (): SessionData => ({ state: 'start' }) }))

bot.command('start', async (ctx) => {
    if (ctx.match) {
        const santa = await SantaModel.findById(ctx.match)
        if (!santa) {
            // TODO: Error message
            await ctx.reply(text.WELCOME_MSG)
            return
        }
        await ctx.api.copyMessage(ctx.chatId, santa.creator, santa.rules)
        // TODO: Add info message
        await ctx.reply(`HELLO`)
        // TODO: Prevent secondary registration
        ctx.session.santaId = ctx.match
        ctx.session.state = 'participate-info'
    } else {
        await ctx.reply(text.WELCOME_MSG)
    }
})

bot.command('new', async (ctx) => {
    await ctx.reply(text.CREATE_START_DATE_MSG)
    ctx.session.state = 'create-start-date'
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
        `Created:\n${created
            .map((santa) => `/my${santa.id}`)
            .join('\n')}\nSelecting title:\n${participated
            .filter((santa) => santa.status == ParticipantStatus.APPROVED)
            .map((santa) => `/choose${santa.id}`)
            .join('\n')}\nWrite a review:\n${participated
            .filter((santa) => santa.status == ParticipantStatus.WATCHING)
            .map((santa) => `/review${santa.id}`)
            .join('\n')}`
    )
})

bot.command('cancel', (ctx) => {
    ctx.session.state = 'start'
})

// TODO: my + id command

const commands = new CommandGroup<MyContext>()

commands.command(/choose(.+)/, 'Choose anime', async (ctx) => {
    const id = ctx.msg.text.slice('/choose'.length)
    const participant = await ParticipantModel.find({
        santa: id,
        user: ctx.from!.id,
        status: ParticipantStatus.APPROVED,
    })

    if (!participant) {
        // TODO: Error message
        return
    }

    ctx.session.santaId = id
    ctx.session.state = 'participate-select-title'
    // TODO: Localize
    await ctx.reply(`Select title`)
})

commands.command(/review(.+)/, 'Review anime', async (ctx) => {
    const id = ctx.msg.text.slice('/review'.length)
    const participant = await ParticipantModel.find({
        santa: id,
        user: ctx.from!.id,
        status: ParticipantStatus.WATCHING,
    })

    if (!participant) {
        // TODO: Error message
        return
    }

    ctx.session.santaId = id
    ctx.session.state = 'participate-write-review'
    // TODO: Localize
    await ctx.reply(`Write review`)
})

bot.use(commands)

const router = new Router<MyContext>((ctx) => ctx.session.state)

router.route('create-start-date').on('message:text', async (ctx) => {
    const res = parse(ctx.msg.text, `dd.MM.yyyy`, new Date())
    if (isNaN(res.valueOf())) {
        await ctx.reply(text.DATE_PARSE_ERROR_MSG)
        return
    }
    const diff = differenceInDays(res, new Date())
    if (diff < 2 || diff > 31) {
        await ctx.reply(text.DATE_INVALID_ERROR_MSG)
        return
    }
    await ctx.reply(text.CREATE_SELECT_DATE_MSG)
    ctx.session.startDate = res
    ctx.session.state = 'create-select-date'
})

router.route('create-select-date').on('message:text', async (ctx) => {
    const res = parse(ctx.msg.text, `dd.MM.yyyy`, new Date())
    if (isNaN(res.valueOf())) {
        await ctx.reply(text.DATE_PARSE_ERROR_MSG)
        return
    }
    if (!ctx.session.startDate) {
        // TODO: Add message
        ctx.session.state = 'create-start-date'
        return
    }
    const diff = differenceInDays(res, ctx.session.startDate)
    if (diff < 2 || diff > 31) {
        await ctx.reply(text.DATE_INVALID_ERROR_MSG)
        return
    }
    await ctx.reply(text.CREATE_DEADLINE_DATE_MSG)
    ctx.session.selectDate = res
    ctx.session.state = 'create-deadline-date'
})

router.route('create-deadline-date').on('message:text', async (ctx) => {
    const res = parse(ctx.msg.text, `dd.MM.yyyy`, new Date())
    if (isNaN(res.valueOf())) {
        await ctx.reply(text.DATE_PARSE_ERROR_MSG)
        return
    }
    if (!ctx.session.selectDate) {
        // TODO: Add message
        ctx.session.state = 'create-select-date'
        return
    }
    const diff = differenceInDays(res, ctx.session.selectDate)
    if (diff < 2 || diff > 31) {
        await ctx.reply(text.DATE_INVALID_ERROR_MSG)
        return
    }

    await ctx.reply(text.CREATE_CHAT_MSG, {
        reply_markup: {
            one_time_keyboard: true,
            is_persistent: true,
            resize_keyboard: true,
            keyboard: [
                [
                    {
                        text: text.SELECT_CHAT_BUTTON,
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
    await ctx.reply(text.CREATE_RULES_MSG, {
        reply_markup: {
            remove_keyboard: true,
        },
    })
    ctx.session.chatId = ctx.msg.chat_shared.chat_id
    ctx.session.state = 'create-rules'
})

router.route('create-rules').on('message:text', async (ctx) => {
    const rulesId = ctx.msg.message_id
    await ctx.reply(text.CREATE_RESTRICTIONS_MSG)
    ctx.session.rulesId = rulesId
    ctx.session.state = 'create-restrictions'
})

router.route('create-restrictions').on('message:text', async (ctx) => {
    const restrictions = parseRestrictions(ctx.msg.text)
    if (!restrictions) {
        await ctx.reply(text.CREATE_RESTRICTIONS_FAILURE_MSG)
        return
    }
    await ctx.reply(text.CREATE_OPTIONS_MSG)
    ctx.session.restrictions = restrictions
    ctx.session.state = 'create-additional-options'
})

router.route('create-additional-options').on('message:text', async (ctx) => {
    // TODO: Add parsing options
    ctx.session.options = new Map()
    // TODO: Validate
    const santa = new SantaModel({
        chat: ctx.session.chatId,
        creator: ctx.chatId,
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
        text.CREATE_FINISH_MSG(
            `https://t.me/${ctx.me.username}?start=${santa.id}`
        )
    )
    ctx.session.state = 'start'
})

router.route('participate-info').on('message:text', async (ctx) => {
    await ctx.reply(text.PARTICIPATE_OPTIONS_MSG)
    ctx.session.infoId = ctx.msg.message_id
    ctx.session.options = new Map()
    ctx.session.state = 'participate-options'
})

router.route('participate-options').on('message', async (ctx) => {
    // TODO: Validate
    const santa = await SantaModel.findById(ctx.session.santaId)
    if (!santa) {
        // TODO: Error message
        ctx.session.state = 'start'
        return
    }
    const participant = new ParticipantModel({
        santa: ctx.session.santaId,
        user: ctx.from.id,
        info: ctx.session.infoId,
        approved: ParticipantStatus.WAITING,
        options: ctx.session.options,
    })
    await participant.save()
    // TODO: Localization
    await ctx.api.sendMessage(
        santa.creator,
        `New participiant ${ctx.from.first_name} (@${ctx.from.username})`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Accept',
                            callback_data: `accept:${santa.id}:${ctx.from.id}`,
                        },
                        {
                            text: 'Reject',
                            callback_data: `reject:${santa.id}:${ctx.from.id}`,
                        },
                    ],
                ],
            },
        }
    )
    await ctx.reply(text.PARTICIPATE_SENT_MSG)
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
        // TODO: Error message
        return
    }
    if (animeLinks.length > 1) {
        // TODO: Error message
        return
    }
    const shikimoriLink = animeLinks[0]
    const santa = await SantaModel.findById(ctx.session.santaId)
    if (!santa) {
        // TODO: Error message
        ctx.session.state = 'start'
        return
    }
    // TODO: Add restrictions to santa
    const valid = await checkShikimoriRestrictions(shikimoriLink, [])
    if (!valid) {
        // TODO: Localize:
        await ctx.reply(`You shall not pass`)
        return
    }

    const participant = await ParticipantModel.findOne({
        user: ctx.from.id,
        santa: ctx.session.santaId,
    })
    if (!participant) {
        // TODO: Error message
        return
    }
    participant.choice = `https://shikimori.one/animes/${shikimoriLink}`
    await participant.save()
    await ctx.reply(text.PARTICIPATE_SELECT_TITLE_SUCCESS_MSG)
    ctx.session.state = 'start'
})

router.route('participate-write-review').on('message:text', async (ctx) => {
    if (ctx.msg.text.split(/\s+/).length < 50) {
        // TODO: Localize
        await ctx.reply(`Too short`)
        return
    }
    const santa = await SantaModel.findById(ctx.session.santaId)
    const participant = await ParticipantModel.findOne({
        user: ctx.msg.from.id,
        santa: ctx.session.santaId,
    })
    if (!participant || !santa) {
        // TODO: Error
        return
    }
    await ctx.forwardMessage(santa.chat ?? santa.creator)

    participant.status = ParticipantStatus.COMPLETED
    await participant.save()
    await ctx.reply(text.PARTICIPATE_WRITE_REVIEW_SUCCESS_MSG)
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
        // TODO: Localize
        await ctx.answerCallbackQuery(`No such user`)
        return
    }

    if (choice == 'accept') {
        participant.status = ParticipantStatus.APPROVED
    } else {
        participant.status = ParticipantStatus.REJECTED
    }

    await participant.save()
    // TODO: Localize
    await ctx.answerCallbackQuery(`Succesfully changed user status`)
})

bot.use(router)

const job = CronJob.from({
    cronTime: '0 10 * * *',
    onTick: async () => {
        const today = startOfDay(new Date())
        const started = await SantaModel.find({ startDate: today })
        // TODO: Add reminders
        const selected = await SantaModel.find({ selectDate: today })
        const deadlined = await SantaModel.find({ deadlineDate: today })

        // TODO: Auto retry
        for (const startedSanta of started) {
            // TODO: Send waiting messages
            const participants = await ParticipantModel.find({
                santa: startedSanta.id,
                status: ParticipantStatus.APPROVED,
            })
            if (participants.length <= 2) {
                // TODO: Delete santa without users
                continue
            }
            const shuffledParticipants = _.shuffle(participants)
            const pairing = new Map<string, string>()
            for (let i = 0; i < shuffledParticipants.length; i++) {
                const current = participants[i]
                const next = participants[(i + 1) % participants.length]
                pairing.set(current.id!.toString(), next.id!.toString())
            }
            startedSanta.pairing = pairing
            await startedSanta.save()
            for (let i = 0; i < shuffledParticipants.length; i++) {
                const current = participants[i]
                const next = participants[(i + 1) % participants.length]
                // TODO: Localize
                await bot.api.sendMessage(
                    current.user,
                    `Please select anime for your ward, his wishes:`
                )
                await bot.api.copyMessage(current.user, next.user, next.info)
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
                    // TODO: Send error message
                    continue
                }
                // TODO: Localize
                await bot.api.sendMessage(
                    to.user,
                    `Your santa selected: ${participant.choice!}. Keep calm and write review before ${
                        selectedSanta.deadlineDate
                    }.`
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

            if (deadlineSanta.chat) {
                // TODO: Localize
                await bot.api.sendMessage(
                    deadlineSanta.chat,
                    `Santa ended, bad users: ${participants.length}`
                )
            }
        }
    },
})

bot.start()
