import { Bot, Context, session, SessionFlavor } from 'grammy'
import { readFileSync } from 'fs'
import toml, { JsonMap } from '@iarna/toml'
import { Router } from '@grammyjs/router'
import * as text from './text';

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

router.route('create-start-date').on('message', async (ctx) => {
    await ctx.reply(text.CREATE_SELECT_DATE_MSG)
    ctx.session.state = 'create-select-date'
})

router.route('create-select-date').on('message', async (ctx) => {
    await ctx.reply(text.CREATE_DEADLINE_DATE_MSG)
    ctx.session.state = 'create-deadline-date'
})

router.route('create-select-date').on('message', async (ctx) => {
    await ctx.reply(text.CREATE_RULES_MSG)
    ctx.session.state = 'create-rules'
})

router.route('create-rules').on('message', async (ctx) => {
    await ctx.reply(text.CREATE_RESTRICTIONS_MSG)
    ctx.session.state = 'create-restrictions'
})

router.route('create-restrictions').on('message', async (ctx) => {
    await ctx.reply(text.CREATE_OPTIONS_MSG)
    ctx.session.state = 'create-additional-options'
})

router.route('create-additional-options').on('message', async (ctx) => {
    await ctx.reply(
        text.CREATE_FINISH_MSG(`https://t.me/frrrrrrbot`)
    )
    ctx.session.state = 'start'
})

router.route('participate-info').on('message', async (ctx) => {
    await ctx.reply('Пара настроек')
    ctx.session.state = 'participate-options'
})

router.route('participate-options').on('message', async (ctx) => {
    await ctx.reply('Вы отправили заявку, дождитесь одобрения администратором')
    ctx.session.state = 'start'
})

router.route('create-additional-options').on('message', async (ctx) => {
    await ctx.reply(
        'Вы успешно создали новую Санту! Не забывайте одобрять участников'
    )
    ctx.session.state = 'start'
})

router.route('participate-select-title').on('message', async (ctx) => {
    await ctx.reply(
        'Вы выбрали тайтл. Когда настанет час он отправится вашему подопечному :3'
    )
    ctx.session.state = 'start'
})

router.route('participate-write-review').on('message', async (ctx) => {
    await ctx.reply('Вы написали ревью!')
    ctx.session.state = 'start'
})

bot.use(router)

bot.start()
