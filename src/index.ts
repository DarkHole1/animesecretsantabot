import { Bot } from "grammy";
import { readFileSync } from "fs";
import toml, { JsonMap } from "@iarna/toml";

const config = toml.parse(readFileSync("config.toml", "utf-8"));
const bot = new Bot((config.Telegram as JsonMap).token as string);

bot.command('start', (ctx) => ctx.reply("Welcome"));

bot.command('new', (ctx) => ctx.reply("New santa"))

bot.start();