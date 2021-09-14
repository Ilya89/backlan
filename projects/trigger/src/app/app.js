const {timer} = require('rxjs');
const {MongoClient} = require('mongodb');
const fs = require('fs');

const mongodb = 'mongodb://localhost:27017/';

async function main() {
    startTrigger();
}

async function connectToMongo() {
    const mongoClient = new MongoClient(mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
    return await mongoClient.connect().catch(err => onError(err));
}

function startTrigger() {
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const timeToNextDay = nextDay.getTime() - nextDay.getTime();
    timer(timeToNextDay, 86400000).subscribe(() => clearOldPosts());
}

async function clearOldPosts() {
    const client = await connectToMongo();

    const db = client.db('backlan');
    const collection = db.collection('posts');
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const oldPosts = await collection.find({
        date: {
            $lt: lastMonth.getTime() / 1000
        }
    }).toArray();
    if (oldPosts) {
        const postsToDelete = [];
        for (const post of oldPosts) {
            postsToDelete.push(post._id);
            if (post.photoPath) {
                fs.unlink(post.photoPath, () => {});
            }
        }
        await collection.deleteMany({_id: {$in: postsToDelete}});
    }

    await client.close();
}

function onError(e) {
    console.log(e);
}

main();
