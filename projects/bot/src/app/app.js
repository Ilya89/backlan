const { multiSearchAnd } = require('./utils');
const { Telegraf, Markup } = require('telegraf');
const { MongoClient, ObjectID } = require('mongodb');

const BOT_TOKEN = '1151296574:AAHSw4fxokpGLSEbZ-V61qTAVHkd8sU_q5s';
const mongodb = 'mongodb://localhost:27017/';
const enterSearchQuery = 'Введите текст для поиска';
const chooseSearchQuery = 'Выберите товар от котрого хотите отписаться';
const allQuery = 'Все';
let collection;
let subscriptions;
let bot;

async function main() {
	await connectToMongo();
	startBot();
	process.on('message', (post) => onNewPost(post));
}

async function connectToMongo() {
	const mongoClient = new MongoClient(mongodb, { useNewUrlParser: true, useUnifiedTopology: true });
	const client = await mongoClient.connect().catch(err => onError(err));
	
	const db = client.db('backlan');
	collection = db.collection('posts');
	subscriptions = db.collection('subscriptions');
}

function startBot() {
	bot = new Telegraf(BOT_TOKEN);
	bot.start((ctx) => ctx.reply('Введите текст для поиска скидок и промокодов или подпишитесь с помощью команды /subscribe'));
	bot.help(async (ctx) => {
		const commands = await ctx.getMyCommands()
		const info = commands.reduce((acc, val) => `${acc}/${val.command} - ${val.description}\n`, '')
		return ctx.reply(info)
	})
	bot.command('subscribe', (ctx) => onSubscribe(ctx));
	bot.command('unsubscribe', (ctx) => onUnsubscribe(ctx).then());
	bot.action(/(.*)/, (ctx) => unsubscribeUser(ctx).then());
	bot.hears(/(.*)/, (ctx) => {
		if (ctx.update.message.reply_to_message && ctx.update.message.reply_to_message.text === enterSearchQuery) {
			subscribeUser(ctx).then();
		} else {
			onText(ctx).then();
		}
	});
	bot.launch();
}

async function onText(ctx) {
	const posts = await findPost(ctx.update.message.text);
	if (posts.length === 0) {
		ctx.reply('Ничего не найдено');
	} else {
		for (const post of posts) {
			if (post.photoPath) {
				ctx.replyWithPhoto({source: post.photoPath}, {caption: post.text}).catch((e) => {
					onError(e);
					ctx.reply(post.text).catch((e) => onError(e));
				});
			} else {
				ctx.reply(post.text).catch((e) => onError(e));
			}
		}
	}
}

function onSubscribe(ctx) {
	ctx.reply(enterSearchQuery, Markup.forceReply());
}

async function onUnsubscribe(ctx) {
	const subs = await subscriptions.find({chat: ctx.chat.id}).toArray();
	if (subs && subs.length !== 0) {
		ctx.reply(chooseSearchQuery, Markup.inlineKeyboard([
			subs.map(sub => Markup.button.callback(sub.text, `${sub._id}`)).concat(Markup.button.callback(allQuery, `${allQuery}`))
		]));
	} else {
		ctx.reply('У Вас нет подписок');
	}
}

async function subscribeUser(ctx) {
	if (!ctx.update.message.text || ctx.update.message.text === '') {
		ctx.reply('Текст для поиска не может быть пустым');
		return;
	}
	const text = ctx.update.message.text.toLowerCase();
	const chatId = ctx.chat.id;
	await addSubscription(text, chatId);
	ctx.reply(`Как только появится скидка или купон с текстом "${ctx.update.message.text}", мы сообщим Вам.`);
}

async function unsubscribeUser(ctx) {
	if (ctx.update.callback_query.data === allQuery) {
		await subscriptions.deleteMany({chat: ctx.chat.id});
		ctx.reply(`Вы отписались от всех скидок и купонов.`);
	} else {
		await subscriptions.deleteOne({_id: new ObjectID(ctx.update.callback_query.data)});
		const text = findInKeyboard(ctx.update.callback_query.message.reply_markup.inline_keyboard, ctx.update.callback_query.data);
		ctx.reply(`Вы отписались от скидок и купонов с текстом "${text}".`);
	}
	await ctx.editMessageReplyMarkup(Markup.removeKeyboard());
}

function findPost(text) {
	text = text.split(/\s+/).map(kw => `"${kw}"`).join(' ');
	return collection.find({$text: {$search: `${text}`}}).limit(15).sort({date: 1}).toArray();
}

async function addSubscription(text, chat) {
	let subscription = await subscriptions.findOne({text, chat});
	if (!subscription) {
		await subscriptions.insertOne({text, chat});
	}
}

function findInKeyboard(inline_keyboard, data) {
	for (const keyboard of inline_keyboard) {
		for (const button of keyboard) {
			if (button.callback_data === data) {
				return button.text;
			}
		}
	}
	return null;
}

function onNewPost(post) {
	const subscriptionsCursor = subscriptions.find();
	subscriptionsCursor.forEach(subscription => {
		if (post.text && multiSearchAnd(post.text, subscription.text)) {
			if (post.photoPath) {
				bot.telegram.sendPhoto(subscription.chat, {source: post.photoPath}, {caption: post.text}).catch((e) => {
					onError(e);
					bot.telegram.sendMessage(subscription.chat, post.text).catch((e) => onError(e));
				});
			} else {
				bot.telegram.sendMessage(subscription.chat, post.text).catch((e) => onError(e));
			}
		}
	})
}

function onError(e) {
	console.log(e);
}

main();
