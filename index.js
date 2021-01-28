// Models
const autoPublish = require("$/models/publish"),
    PingSubscription = require("$/models/pingSubscription");

// Packages
const fs = require("fs"),
    Discord = require("discord.js"),
    mongoose = require("mongoose"), // Library for MongoDB
    express = require("express"),
    axios = require("axios"),
    path = require("path"),
    Sentry = require("@sentry/node"),
    winston = require("winston"); // Advanced logging library

// Local config files
const config = require("$/config.json");

// Pre-init
// Winston logger
const date = new Date().toISOString();
const logger = winston.createLogger({
    level: config.logLevel,
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({filename: path.join(__dirname, "logs", "error", `${date}.log`), level: "error"}),
        new winston.transports.File({filename: path.join(__dirname, "logs", "complete", `${date}.log`)})
    ]
});
exports.logger = logger;

// Create a Discord client
const client = new Discord.Client({
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'] // Partials are used to be able to fetch events from non cached items
});
exports.client = client;

// Local JS files
const youtubeNotifications = require("$/util/youtube"),
    twitterNotifications = require("$/util/twitter"),
    dashboardRouter = require("$/routers/dashboard");

// Variables

// Init
// Sentry
if(config.environment === "production") Sentry.init({ dsn: config.sentryDsn });

// Mongoose
mongoose.connect(`mongodb+srv://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}/${config.mongodb.database}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

// Express
const app = express();
app.use("/yt", youtubeNotifications.router);
app.use("/dash", dashboardRouter);
app.listen(config.PubSubHubBub.hubPort);

// Notifications preparation
if(config.environment === "production") {
    youtubeNotifications.init(logger);
    twitterNotifications.init(logger);
}

// Code
// Discord bot
client.on("ready", () => {
    client.commands = new Discord.Collection(); // This holds all the commands accessible for the end users.
    client.devcmds = new Discord.Collection(); // This will hold commands that are only accessible for the maintainers
    client.staffcmds = new Discord.Collection(); // This will hold commands that are only accessible for staff
    loadcmds();
    logger.info("Bot online");
});

// Ping list reaction handler
client.on("messageReactionAdd", (reaction, user) => {
    if (user.id === client.user.id) return;
    reaction.fetch().then((reaction) => {
        PingSubscription.findById(reaction.message.id, (err, doc) => {
            if (err) return logger.error(err);
            if (!doc || reaction.emoji.name !== doc.emoji) return;
            const filter = (id) => id === user.id;
            const index = doc.users.findIndex(filter);
            if (index !== -1) return;
            doc.users.push(user.id);
            doc.save();
            logger.debug(`${user.tag} has been added to ${doc.name}`);
        });
    });
});

client.on("messageReactionRemove", (reaction, user) => {
    if (user.id === client.user.id) return;
    reaction.fetch().then((reaction) => {
        PingSubscription.findById(reaction.message.id, (err, doc) => {
            if (err) return logger.error(err);
            if (!doc || reaction.emoji.name !== doc.emoji) return;
            const filter = (id) => id === user.id;
            const index = doc.users.findIndex(filter);
            if (index === -1) return;
            doc.users.splice(index, 1);
            doc.save();
            logger.debug(`${user.tag} has been removed from ${doc.name}`);
        });
    });
});

// Auto publish handler
client.on("message", (message) => {
    autoPublish.findById(message.channel.id, (err, doc) => {
        if (err) return logger.error(err);
        if(doc) {
            const { options: { http } } = client;
            if(message.channel.type === "news") {
                axios({
                    method: "POST",
                    url: `${http.api}/v${http.version}/channels/${message.channel.id}/messages/${message.id}/crosspost`,
                    headers: {
                        'Authorization': `Bot ${config.discord.token}`,
                    }
                })
                    .catch(() => {}); // Ignore errors
            } else {
                doc.autoPublish = false;
                doc.save();
            }
        }
    })
});

// Message handler
client.on("message", (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(config.discord.prefix)) { // User command handler
        let cont = message.content.slice(config.discord.prefix.length).split(" ");
        let args = cont.slice(1);

        let staffCmd = client.staffcmds.get(cont[0]);
        if(staffCmd && message.member.roles.cache.has(config.discord.roles.staff)) return staffCmd.run(client, message, args);
        let cmd = client.commands.get(cont[0]);

        if (cmd) return cmd.run(client, message, args);
    } else if (message.content.startsWith(config.discord.devprefix)) { // Dev command handler
        if (!message.member.roles.cache.has(config.discord.roles.dev)) return;
        let cont = message.content.slice(config.discord.devprefix.length).split(" ");
        if (cont[0] === "reload") {
            message.channel.send("Reloading commands...");
            loadcmds();
            return message.channel.send("All commands have been reloaded.");
        }
        let args = cont.slice(1);
        let cmd = client.devcmds.get(cont[0]);
        if (cmd) return cmd.run(client, message, args);
    }
})

client.login(config.discord.token);

// Functions
function loadcmds() {
    // Unload all loaded commands in case it's a reload
    client.commands.forEach((cmd) => {
        client.commands.delete(cmd.config.command);
        delete require.cache[require.resolve(`./commands/user/${cmd.config.command}.js`)];
    });
    client.devcmds.forEach((cmd) => {
        client.devcmds.delete(cmd.config.command);
        delete require.cache[require.resolve(`./commands/dev/${cmd.config.command}.js`)];
    });
    client.staffcmds.forEach((cmd) => {
        client.staffcmds.delete(cmd.config.command);
        delete require.cache[require.resolve(`./commands/staff/${cmd.config.command}.js`)];
    });

    // Fetch all files, filter and load them
    fs.readdir("./commands/user", (err, files) => { // Read all the files in the directory, these are commands available to normal users.
        if (err) throw (err);
        const jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return logger.info("No user commands found.");
        }
        jsfiles.forEach((f) => {
            delete require.cache[require.resolve(`./commands/user/${f}`)];
            const cmd = require(`./commands/user/${f}`);
            client.commands.set(cmd.config.command, cmd);
        });
    });
    fs.readdir("./commands/dev", (err, files) => { // Commands only available to the developer, these can break.
        if (err) throw (err);
        const jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return logger.info("No dev commands found.");
        }
        jsfiles.forEach((f) => {
            delete require.cache[require.resolve(`./commands/dev/${f}`)];
            const cmd = require(`./commands/dev/${f}`);
            client.devcmds.set(cmd.config.command, cmd);
        });
    });
    fs.readdir("./commands/staff", (err, files) => { // Commands only available to the staff
        if (err) throw (err);
        const jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return logger.info("No staff commands found.");
        }
        jsfiles.forEach((f) => {
            delete require.cache[require.resolve(`./commands/staff/${f}`)];
            const cmd = require(`./commands/staff/${f}`);
            client.staffcmds.set(cmd.config.command, cmd);
        });
    });
}