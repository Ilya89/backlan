const path = require('path');
const fork = require('child_process').fork;

const botPath = path.resolve('./projects/bot/src/app/app.js');
const listenerPath = path.resolve('./projects/listener/src/app/app.js');
const triggerPath = path.resolve('./projects/trigger/src/app/app.js');

const bot = fork(botPath);
const listener = fork(listenerPath);
fork(triggerPath);

listener.on('message', result => {
    bot.send(result);
});
