// Models
const Subscription = require("$/models/subscription"),
    PingSubscription = require("$/models/pingSubscription"),
    Livestream = require("$/models/stream");

// Packages
const fs = require("fs"),
    Discord = require("discord.js"),
    mongoose = require("mongoose"), // Library for MongoDB
    xml2js = require("xml2js"),
    express = require("express"),
    axios = require("axios"),
    {createHmac} = require("crypto"),
    {scheduleJob} = require("node-schedule"),
    rawBody = require("raw-body"),
    querystring = require("querystring"),
    {google} = require("googleapis"),
    path = require("path"),
    puppeteer = require("puppeteer"), // Headless Chromium browser
    winston = require("winston"); // Advanced logging library

// Local JS files
const {confirmRequest} = require("./util/functions");

// Local config files
const config = require("$/config.json");

// Variables
let scheduledStreams = []; // This array will hold all streams that have been scheduled with node-schedule during this run
const puppeteerOptions = {
    args: ["--disable-dev-shm-usage", "--no-sandbox"]
}

// Init
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

// XML Parser
const xmlParser = new xml2js.Parser({explicitArray: false});

// Mongoose
mongoose.connect(`mongodb+srv://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}/${config.mongodb.database}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

// Google YT Data V3 API
const YT = google.youtube("v3");

// Express
const app = express();
app.listen(config.PubSubHubBub.hubPort);

//* Get all planned livestreams from subscriptions and add them to schedule.
const videoRegex = /\/watch\?v=.{11}/g;
Subscription.find({}).lean().exec(async (err, docs) => {
    if (err) throw new Error("Couldn't read subscriptions");

    const browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();

    for (let i = 0; i < docs.length; i++) {
        await page.goto(`https://www.youtube.com/channel/${docs[i]._id}/videos?view=2&live_view=502&flow=grid`);
        const content = await page.content();

        const matches = await content.match(/Upcoming live streams/g);
        const isPlannedStreamPage = matches !== null && matches.length > 0;

        if (isPlannedStreamPage) {
            const rawStreams = await content.match(videoRegex);
            let streams = [];

            for(let i = 0; i < rawStreams.length; i++) {
                const videoID = await rawStreams[i].substring("/watch?v=".length);
                const index = streams.findIndex((id) => id === videoID);
                if(index === -1) streams.push(videoID);
            }

            for (let i = 0; i < streams.length; i++) {
                await Livestream.findById(streams[i]).lean().exec((err2, doc) => {
                    if (err2) return logger.error(err2);
                    if (!doc) {
                        YT.videos.list({
                            auth: config.YtApiKey,
                            id: streams[i],
                            part: "snippet,liveStreamingDetails"
                        }, (err3, video) => {
                            if (err3) return logger.verbose(err3);
                            if (video.data.items[0].liveBroadcastContent !== "upcoming") return;
                            const stream = new Livestream({
                                _id: streams[i],
                                plannedDate: video.data.items[0].liveStreamingDetails.scheduledStartTime,
                                title: video.data.items[0].snippet.title,
                                ytChannelID: docs[i]._id
                            });
                            stream.save();
                        });
                    }
                });
            }
        }

        await Livestream.find({}).lean().exec((err2, docs) => {
            if (err2) return logger.error(err2);
            for (let i = 0; i < docs.length; i++) {
                const plannedDate = new Date(docs[i].plannedDate);
                Subscription.findById(docs[i].ytChannelID).lean().exec((err3, subscription) => {
                    const feed = { // Recreating the PubSubHubBub feed as the function is coded to use this
                        entry: [
                            {
                                "yt:videoId": [docs[i]._id],
                                "yt:channelId": [docs[i].ytChannelID],
                                "title": [docs[i].title],
                                "link": [
                                    {
                                        "$": {
                                            "href": `https://www.youtube.com/watch?v=${docs[i]._id}`
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                    scheduleJob(plannedDate, () => {
                        setTimeout(() => {
                            checkLive(feed, subscription);
                        }, 5 * 60 * 1000);
                    });
                    scheduledStreams.push(docs[i]._id);
                });
            }
        });
    }
    await browser.close();
});

// Add all subscriptions
scheduleJob("0 * * * *", () => { // Resubscribe every hour
    Subscription.find({}).lean().exec((err, docs) => {
        if (err) throw new Error("Couldn't read subscriptions");
        for (let i = 0; i < docs.length; i++) {
            try {
                axios({
                    url: "http://pubsubhubbub.appspot.com/",
                    method: "POST",
                    headers: {"content-type": "application/x-www-form-urlencoded"},
                    data: querystring.stringify({
                        "hub.mode": "subscribe",
                        "hub.callback": `${config.PubSubHubBub.callbackUrl}/ytPush/${docs[i]._id}`,
                        "hub.topic": `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${docs[i]._id}`,
                        "hub.lease_seconds": `${60 * 60}`, // 1 hour lease
                        "hub.secret": config.PubSubHubBub.secret,
                    }),
                }).then((res) => {
                    if (res.status === 202) logger.verbose(`Subscription to ${docs[i]._id} successful.`);
                    else logger.verbose(`Subscription to ${docs[i]._id} gave response: ${res.status}`);
                }).catch(err2 => {
                    if (err2) logger.warn(`Error: ${err2.response.status}, subscription to ${docs[i]._id} unsuccessful.`);
                });
            } catch (err2) {
                if (err2) return logger.warn(`Couldn't subscribe to channel: ${docs[i]._id}`);
            }
        }
    });
});

// Code

// PubSubHubBub notifications
app.get("/ytPush/:id", (req, res) => {
    logger.debug(req.query["hub.challenge"]);
    if (req.query["hub.challenge"].length > 0) {
        logger.verbose(`Responding with challenge code for channel: ${req.params.id}`);
        res.status(200).send(req.query["hub.challenge"]);
        logger.debug("-----------------------------------------");
    } else res.status(400).send("");
});

app.post("/ytPush/:id", parseBody, (req, res) => {
    const xhs = req.headers["x-hub-signature"] || req.headers["X-Hub-Signature"];
    logger.debug(xhs);
    logger.debug("-----------------------------------------");
    logger.debug(JSON.stringify(req.body.feed, null, 4));
    logger.debug("-----------------------------------------");
    res.status(200).send("");
    if (req.body.feed["at:deleted-entry"]) return; // This means a stream/video got set to private or was deleted
    // TODO: Check if stream has ended and delete the embed.
    Livestream.findById(req.body.feed.entry[0]["yt:videoId"][0]).lean().exec((err, doc) => {
        if (err) return logger.error(err);
        if (doc) return;
    });
    Subscription.findById(req.body.feed.entry["yt:channelId"], (err, subscription) => {
        if (err) return logger.verbose(err);
        YT.videos.list({
            auth: config.YtApiKey,
            id: req.body.feed.entry[0]["yt:videoId"][0],
            part: "snippet,liveStreamingDetails"
        }, (err2, video) => {
            if (err2) return logger.verbose(err2);
            if (video.data.items[0].liveBroadcastContent === "none") return;
            const stream = new Livestream({
                _id: req.body.feed.entry[0]["yt:videoId"][0],
                plannedDate: video.data.items[0].liveStreamingDetails.scheduledStartTime,
                title: video.data.items[0].snippet.title
            });
            stream.save();
            const currentDate = new Date(),
                plannedDate = new Date(video.data.items[0].liveStreamingDetails.scheduledStartTime);
            const diffTime = Math.ceil(Math.abs(plannedDate - currentDate) / 1000 / 60); // Time difference between current in minutes
            if (diffTime >= 10) {
                scheduleJob(plannedDate, () => {
                    setTimeout(() => {
                        checkLive(req.body.feed, subscription);
                    }, 5 * 60 * 1000);
                });
                scheduledStreams.push(req.body.feed.entry[0]["yt:videoId"][0]);
            } else {
                setTimeout(() => {
                    checkLive(req.body.feed, subscription);
                }, 5 * 60 * 1000);
            }
        });
    });
});

// Discord bot
// Create a Discord client
const client = new Discord.Client({
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'] // Partials are used to be able to fetch events from non cached items
});

client.on("ready", () => {
    client.commands = new Discord.Collection(); // This holds all the commands accessible for the end users.
    client.devcmds = new Discord.Collection(); // This will hold commands that are only accessible for the maintainers
    client.staffcmds = new Discord.Collection(); // This will hold commands that are only accessible for staff
    loadcmds();
    logger.info("Bot online");
});

// Ping list reaction handler
client.on('messageReactionAdd', (reaction, user) => {
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

client.on('messageReactionRemove', (reaction, user) => {
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

// Message handler
client.on("message", (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(config.discord.prefix)) { // User command handler
        if (!message.member.roles.cache.has(config.discord.roles.musician) && !message.member.roles.cache.has(config.discord.roles.staff)) return;
        let cont = message.content.slice(config.discord.prefix.length).split(" ");
        let args = cont.slice(1);
        let cmd = client.commands.get(cont[0]);
        if (!cmd) return;
        if (!message.member.roles.cache.has(config.discord.roles.musician)) {
            message.reply("you don't have the musician role, do you still want to perform this action?").then(msg => {
                confirmRequest(msg, message.author.id)
                    .then(result => {
                        if (result === true) {
                            msg.delete({reason: "Automated"});
                            return cmd.run(client, message, args);
                        } else {
                            message.delete({reason: "Automated"});
                            return msg.delete({reason: "Automated"});
                        }
                    });
            });

        } else {
            return cmd.run(client, message, args);
        }
    } else if (message.content.startsWith(config.discord.staffprefix)) {
        if (!message.member.roles.cache.has(config.discord.roles.staff)) return;
        let cont = message.content.slice(config.discord.staffprefix.length).split(" ");
        let args = cont.slice(1);
        let cmd = client.staffcmds.get(cont[0]);
        if (!cmd) return;
        return cmd.run(client, message, args);
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
    fs.readdir("./commands/user", (err, files) => { // Read all the files in the directory, these are commands available to Musicians. Override available for staff.
        if (err) throw (err);
        let jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return logger.info("No user commands found.");
        }
        jsfiles.forEach((f, i) => {
            delete require.cache[require.resolve(`./commands/user/${f}`)];
            const cmd = require(`./commands/user/${f}`);
            client.commands.set(cmd.config.command, cmd);
        });
    });
    fs.readdir("./commands/dev", (err, files) => { // Commands only available to the developer, these can break.
        if (err) throw (err);
        let jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return logger.info("No dev commands found.");
        }
        jsfiles.forEach((f, i) => {
            delete require.cache[require.resolve(`./commands/dev/${f}`)];
            const cmd = require(`./commands/dev/${f}`);
            client.devcmds.set(cmd.config.command, cmd);
        });
    });
    fs.readdir("./commands/staff", (err, files) => { // Commands only available to the staff
        if (err) throw (err);
        let jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return logger.info("No staff commands found.");
        }
        jsfiles.forEach((f, i) => {
            delete require.cache[require.resolve(`./commands/staff/${f}`)];
            const cmd = require(`./commands/staff/${f}`);
            client.staffcmds.set(cmd.config.command, cmd);
        });
    });
}

async function parseBody(req, res, next) {
    try {
        const raw = await rawBody(req);
        req.body = await xml2js.parseStringPromise(raw);
        next();
    } catch (error) {
        next(error);
    }
}

function checkLive(feed, subscription) {
    let removedChannels = [];
    YT.videos.list({
        auth: config.YtApiKey,
        id: feed.entry[0]["yt:videoId"][0],
        part: "snippet,liveStreamingDetails"
    }, (err, video) => {
        if (err) return logger.error(err);
        if (!video) return logger.verbose("Video not found");
        logger.debug("-----------------------------------------");
        logger.debug(JSON.stringify(video, null, 4));
        logger.debug("-----------------------------------------");
        if (video.data.items[0].snippet.liveBroadcastContent !== "live") {
            Livestream.findById(feed.entry[0]["yt:videoId"][0], (err2, stream) => {
                if (err2) return logger.error(err2);
                if (stream.retry === false) {
                    return setTimeout(() => {
                        checkLive(feed, subscription);
                    }, 10 * 60 * 1000);
                } else return logger.debug("Not a live broadcast.");
            });
        }
        YT.channels.list({
            auth: config.YtApiKey,
            id: feed.entry[0]["yt:channelId"][0],
            part: "snippet"
        }, (err2, ytChannel) => {
            if (err2) return logger.error(err2);
            for (let i = 0; i < subscription.channels.length; i++) {
                client.channels.fetch(subscription.channels[i])
                    .then((channel) => {
                        channel.fetchWebhooks()
                            .then((hooks) => {
                                const webhook = hooks.find(wh => wh.name.toLowerCase() === "stream notification");
                                if (!webhook) return removedChannels.push(i);
                                const embed = new Discord.MessageEmbed()
                                    .setTitle(feed.entry[0].title[0])
                                    .setURL(feed.entry[0].link[0]["$"].href)
                                    .setImage(video.items[0].snippet.thumbnails.maxres.url)
                                    .setColor("#FF0000")
                                    .setFooter("Powered by Suisei's Mic")

                                webhook.send(subscription.message, {
                                    embeds: [embed],
                                    username: ytChannel.items[0].snippet.title,
                                    avatarURL: ytChannel.items[0].snippet.thumbnails.high
                                }).then((msg) => {
                                    Livestream.findByIdAndUpdate(feed.entry[0]["yt:videoId"][0], {messageID: msg.id}, (err3) => {
                                        if (err3) logger.error(err3);
                                    });
                                });
                            });
                    })
                    .catch((err3) => {
                        if (err3) removedChannels.push(i);
                    });
            }
            for (let i = 0; i < removedChannels.length; i++) {
                subscription.channels.splice(subscription.channels.findIndex(removedChannels[i]), 1);
            }
        });
    });
}

exports.planLivestreams = async function (channelID) {
    const browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();

    await page.goto(`https://www.youtube.com/channel/${channelID}/videos?view=2&live_view=502&flow=grid`);
    const content = await page.content();

    const matches = await content.match(/Upcoming live streams/g);
    const isPlannedStreamPage = matches !== null && matches.length > 0;

    if (!isPlannedStreamPage) return browser.close();

    const rawStreams = await content.match(videoRegex);
    let streams = [];
    let streamIDs = [];

    for(let i = 0; i < rawStreams.length; i++) {
        const videoID = await rawStreams[i].substring("/watch?v=".length);
        const index = streamIDs.findIndex((id) => id === videoID);
        if(index === -1) streamIDs.push(videoID);
    }

    for (let i = 0; i < streamIDs.length; i++) {
        await Livestream.findById(streamIDs[i]).lean().exec((err2, doc) => {
            if (err2) return logger.error(err2);
            if (!doc) {
                YT.videos.list({
                    auth: config.YtApiKey,
                    id: streamIDs[i],
                    part: "snippet,liveStreamingDetails"
                }, (err3, video) => {
                    if (err3) return logger.verbose(err3);
                    if (video.data.items[0].liveBroadcastContent !== "upcoming") return;
                    streams.push({
                        id: streamIDs[i],
                        plannedDate: video.data.items[0].liveStreamingDetails.scheduledStartTime,
                        title: video.data.items[0].snippet.title
                    });
                    const stream = new Livestream({
                        _id: streamIDs[i],
                        plannedDate: video.data.items[0].liveStreamingDetails.scheduledStartTime,
                        title: video.data.items[0].snippet.title,
                        ytChannelID: channelID
                    });
                    stream.save();
                });
            }
        });
    }
    await browser.close();

    for (let i = 0; i < streams.length; i++) {
        const plannedDate = new Date(streams[i].plannedDate);
        await Subscription.findById(channelID).lean().exec((err3, subscription) => {
            const feed = { // Recreating the PubSubHubBub feed as the function is coded to use this
                entry: [
                    {
                        "yt:videoId": [streams[i].id],
                        "yt:channelId": [channelID],
                        "title": [streams[i].title],
                        "link": [
                            {
                                "$": {
                                    "href": `https://www.youtube.com/watch?v=${streams[i]._id}`
                                }
                            }
                        ]
                    }
                ]
            }
            scheduleJob(plannedDate, () => {
                setTimeout(() => {
                    checkLive(feed, subscription);
                }, 5 * 60 * 1000);
            });
            scheduledStreams.push(streams[i]._id);
        });
    }
}
