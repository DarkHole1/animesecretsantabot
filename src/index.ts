import { Bot, Context, session, SessionFlavor } from 'grammy'
import { readFileSync } from 'fs'
import toml, { JsonMap } from '@iarna/toml'
import { Router } from '@grammyjs/router'
import * as text from './text'
import { differenceInDays, parse } from 'date-fns'

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
}

type MyContext = Context & SessionFlavor<SessionData>

const config = toml.parse(readFileSync('config.toml', 'utf-8'))
const bot = new Bot<MyContext>((config.Telegram as JsonMap).token as string)

bot.use(session({ initial: (): SessionData => ({ state: 'start' }) }))

bot.command('start', async (ctx) => {
    await ctx.reply(text.WELCOME_MSG)
    ctx.session.state = 'participate-info'
})

bot.command('new', async (ctx) => {
    await ctx.reply(text.CREATE_START_DATE_MSG)
    ctx.session.state = 'create-start-date'
})

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
    // TODO: Save in session
    await ctx.reply(text.CREATE_SELECT_DATE_MSG)
    ctx.session.state = 'create-select-date'
})

router.route('create-select-date').on('message:text', async (ctx) => {
    const res = parse(ctx.msg.text, `dd.MM.yyyy`, new Date())
    if (isNaN(res.valueOf())) {
        await ctx.reply(text.DATE_PARSE_ERROR_MSG)
        return
    }
    // TODO: Add check for difference from select date
    // TODO: Save in session
    await ctx.reply(text.CREATE_DEADLINE_DATE_MSG)
    ctx.session.state = 'create-deadline-date'
})

router.route('create-deadline-date').on('message:text', async (ctx) => {
    const res = parse(ctx.msg.text, `dd.MM.yyyy`, new Date())
    if (isNaN(res.valueOf())) {
        await ctx.reply(text.DATE_PARSE_ERROR_MSG)
        return
    }
    // TODO: Add check for difference from select date
    // TODO: Save in session
    await ctx.reply(text.CREATE_RULES_MSG)
    ctx.session.state = 'create-rules'
})

router.route('create-rules').on('message:text', async (ctx) => {
    const rulesId = ctx.msg.message_id;
    // TODO: Save in session
    await ctx.reply(text.CREATE_RESTRICTIONS_MSG)
    ctx.session.state = 'create-restrictions'
})

router.route('create-restrictions').on('message', async (ctx) => {
    await ctx.reply(text.CREATE_OPTIONS_MSG)
    ctx.session.state = 'create-additional-options'
})

router.route('create-additional-options').on('message', async (ctx) => {
    await ctx.reply(text.CREATE_FINISH_MSG(`https://t.me/frrrrrrbot`))
    ctx.session.state = 'start'
})

router.route('participate-info').on('message', async (ctx) => {
    await ctx.reply(text.PARTICIPATE_OPTIONS_MSG)
    ctx.session.state = 'participate-options'
})

router.route('participate-options').on('message', async (ctx) => {
    await ctx.reply(text.PARTICIPATE_SENT_MSG)
    ctx.session.state = 'start'
})

router.route('participate-select-title').on('message', async (ctx) => {
    await ctx.reply(text.PARTICIPATE_SELECT_TITLE_SUCCESS_MSG)
    ctx.session.state = 'start'
})

router.route('participate-write-review').on('message', async (ctx) => {
    await ctx.reply(text.PARTICIPATE_WRITE_REVIEW_SUCCESS_MSG)
    ctx.session.state = 'start'
})

bot.use(router)

bot.start()
