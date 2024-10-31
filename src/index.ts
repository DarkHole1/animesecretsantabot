import { Bot, Context, session, SessionFlavor } from "grammy";
import { readFileSync } from "fs";
import toml, { JsonMap } from "@iarna/toml";
import { Router } from "@grammyjs/router";

type SessionData = {
  state:
    | "start"
    | "create-rules"
    | "create-restrictions"
    | "create-additional-options";
};

type MyContext = Context & SessionFlavor<SessionData>;

const config = toml.parse(readFileSync("config.toml", "utf-8"));
const bot = new Bot<MyContext>((config.Telegram as JsonMap).token as string);

bot.use(session({ initial: (): SessionData => ({ state: "start" }) }));

bot.command("start", (ctx) => ctx.reply("Welcome"));

bot.command("new", async (ctx) => {
  await ctx.reply("New santa");
  ctx.session.state = "create-rules";
});

const router = new Router<MyContext>((ctx) => ctx.session.state);

router.route("create-rules").on("message", async (ctx) => {
  await ctx.reply("Теперь добавьте ограничения на выбранный тайтл");
  ctx.session.state = "create-restrictions";
});

router.route("create-restrictions").on("message", async (ctx) => {
  await ctx.reply("Отлично! Осталось немного дополнительных опций...");
  ctx.session.state = "create-additional-options";
});

router.route("create-additional-options").on("message", async (ctx) => {
  await ctx.reply(
    "Вы успешно создали новую Санту! Не забывайте одобрять участников"
  );
  ctx.session.state = "start";
});

bot.use(router);

bot.start();
