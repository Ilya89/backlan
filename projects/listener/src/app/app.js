const {MongoClient} = require('mongodb');
const {Client} = require('tdl');
const {TDLib} = require('tdl-tdlib-ffi');

const mongodb = 'mongodb://localhost:27017/';
const chats = [
    -1001253787508, // andro-price.com
    -1001141858640, // Халявщики
    -1001479683010, // SKIDONUS RU // sintetiki.net
    -1001155551284, // Детский мир
    -1001186146098, // Акции | Халява | Промокоды
    -1001165767862, // РИВ ГОШ
    -1001286465648, //  Промокоды АлиЭкспресс, купоны, товары,
    -1001317503116, // Sneakersdeal
    -1001136512589, // Кроссовки на скидках ⚡
    -1001252460390, // sintetiki.net | скидки и купоны от Антона
    -1001122357347, // Pepper.RU
    -1001147267242, // Скидки от MYSKU.ru
    -1001100124762, // HotPrice от Pepper.ru
    -1001134847986, // Халява тут �
    -1001276603446, // LowCoster
    -1001173479055, // Залез в Aliexpress
    -1001169936181, // СКИДОНЫЧ
    -1001099181539, // Находки AliExpress
    -1001100166066, // Всё для мужика
    -1001004209373, // AppleInsider.ru #скидочки
    -1001138895372, // Шмотки на скидках
    -1001311430273, // Промокоды | Акции | Халява | Бесплатно
    -1001122966378, // Лента
    -1001148071378, // AliExpress | Черная Пятница Купоны▫️Гаджеты▫️Смартфоны▫️Китай▫️Лайфхаки▫️Шоппинг▫️Такси▫️Технологии▫️Подарки
    -1001004962424, // AliExpress
    -1001118070842, // Скидки! Скидки!! Скидки!!!
    -1001046463780, // PlayStation ⚡️ Скидки
    -1001270051017, // © ЖЕЛЕЗНЫЙ АЛИЭКСПРЕСС
    -1001129241203, // Скидки, промокоды, акции - DailySales
    -1001331540835, // AlexisKiss_aliexpress
    -1001377036299, // METRO Cash & Carry
    -1001304054719, // АлкоСкидон Пермь �
    -1001496297463 // Тестовый канал
];
let collection;

async function main() {
    await connectToMongo();
    await startTelegram();
}

async function connectToMongo() {
    const mongoClient = new MongoClient(mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
    const client = await mongoClient.connect().catch(err => onError(err));

    const db = client.db('backlan');
    collection = db.collection('posts');
}

async function startTelegram() {
    const client = new Client(new TDLib(), {
        apiId: 1347697,
        apiHash: '808db0d28a9bc595354f9c45223ce935'
    });

    await client.connectAndLogin(() => ({
        type: 'user',
        getPhoneNumber: () => Promise.resolve('+79223698901'),
        getAuthCode: () => Promise.resolve('63346')
    }));

    /*for (const chatId of chats) {
        console.log(`Start load history ${chatId}`);
        await loadHistory(client, chatId);
        console.log(`End load history ${chatId}`);
    }*/
    /*console.log(`Start load history ${-1001304054719}`);
    await loadHistory(client, -1001304054719);
    console.log(`End load history ${-1001304054719}`);*/
    // await printChats(client);

    client
        .on('update', update => {
            if (chats.some(chat => chat === update.chat_id)) {
                if (update._ === 'updateChatLastMessage') {
                    addPost(client, update.last_message);
                }
            }
        })
        .on('error', err => onError(err))
        .on('destroy', () => {});
}

async function printChats(client) {
    console.log('Chats');
    try {
        const chats = await client.invoke({
            '_': 'getChats',
            'offset_order': '9223372036854775807',
            'offset_chat_id': 0,
            'limit': 50,
        });
        for (const chatId of chats.chat_ids) {
            const chat = await client.invoke({
                '_': 'getChat',
                'chat_id': chatId
            });
            console.log(`${chat.id}, // ${chat.title}`);
        }
    } catch (e) {
        console.log(e);
    }
}

async function addPost(client, message) {
    if (!message) {
        return false;
    }
    const post = await convertMessageToPost(client, message);
    if (!post.text) {
        return false;
    }
    const result = await collection.findOne({id: post.id, chat: post.chat});
    if (!result) {
        await collection.insertOne(post);
        process.send(post)
        return true;
    }
    return false;
}

async function convertMessageToPost(client, message) {
    const post = {id: message.id, chat: message.chat_id, date: message.date};
    if (message.content.photo && message.content.photo.sizes && message.content.photo.sizes.length) {
        const size = message.content.photo.sizes[message.content.photo.sizes.length - 1];
        if (size.photo) {
            if (size.photo.local && size.photo.local.path) {
                post.photoPath = size.photo.local.path;
            } else if (size.photo.remote) {
                try {
                    const file = await client.invoke({
                        '_': 'downloadFile',
                        'file_id': size.photo.id,
                        'priority': 1,
                        'offset': 0,
                        'limit': 0,
                        'synchronous': true
                    }).catch((e) => {
                        onError(e);
                    });
                    post.photoPath = file.local.path;
                } catch (e) {
                    const reMessage = await client.invoke({
                        '_': 'getMessage',
                        'chat_id': message.chat_id,
                        'message_id': message.id
                    });
                    const reSize = reMessage.content.photo.sizes[reMessage.content.photo.sizes.length - 1];

                    const reFile = await client.invoke({
                        '_': 'downloadFile',
                        'file_id': reSize.photo.id,
                        'priority': 1,
                        'offset': 0,
                        'limit': 0,
                        'synchronous': true
                    });
                    post.photoPath = reFile.local.path;
                }
            }
        }

    }
    if (message.content.text && message.content.text.text) {
        post.text = message.content.text.text;
    } else if (message.content && message.content.caption && message.content.caption.text) {
        post.text = message.content.caption.text;
    }
    return post;
}

async function loadHistory(client, chatId) {
    let result = await getMessages(client, chatId);
    let step = 1;
    while (step < 10) {
        result = await getMessages(client, chatId, result.messageId, result.count);
        step++;
    }
}

async function getMessages(client, chatId, messageId, count) {
    if (!messageId) {
        const chat = await client.invoke({
            _: 'getChat',
            chat_id: chatId
        });

        messageId = chat.last_message.id;
    }

    const history = await client.invoke({
        _: 'getChatHistory',
        chat_id: chatId,
        from_message_id: messageId,
        offset: 0,
        limit: 100,
        only_local: false
    });

    if (!count) {
        count = 0;
    }
    if (history.total_count > 0) {
        messageId = history.messages[history.total_count - 1].id;
        for (const message of history.messages) {
            if (await addPost(client, message)) {
                count++;
            }
            if (count > 100) {
                break;
            }
        }
    }
    return {count: count, messageId: messageId};
}

function onError(e) {
    console.log(e);
}

main();
