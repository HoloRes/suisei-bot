// Models
const Subscription = require("$/models/subscription");

// Packages
const fs = require("fs"),
    Discord = require("discord.js"),
    mongoose = require("mongoose"), // Library for MongoDB
    xml2js = require("xml2js"),
    PubHubSubBub = require("pubsubhubbub"), // Library for YouTube notifications
    {google} = require("googleapis");

// Local JS files
const {confirmRequest} = require("./util/functions");

// Local config files
const config = require("$/config.json");

// Init
// XML Parser
const xmlParser = new xml2js.Parser({explicitArray: false});

// Mongoose
mongoose.connect(`mongodb+srv://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}/${config.mongodb.database}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// PubSubHubBub
const pubHubSubscriber = PubHubSubBub.createServer({
    secret: config.PubHubSubBub.secret,
    callbackUrl: config.PubHubSubBub.callbackUrl
});
pubHubSubscriber.listen(config.PubHubSubBub.hubPort);

// Add all subscriptions
Subscription.find({}).lean().exec((err, docs) => {
   if(err) throw new Error("Couldn't read subscriptions");
   for(let i = 0; i < docs.length; i++) {
       pubHubSubscriber.subscribe(
           `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${docs[i]._id}`,
           "https://pubsubhubbub.appspot.com",
           (err2) => {
               if(err2) console.error(`Couldn't subscribe to channel: ${docs[i]._id}`);
           });
   }
});

// Google YT Data V3 API
const YT = google.youtube("v3");

// Code

// PubSubHubBub notifications
pubHubSubscriber.on("feed", (data) => {
    let removedChannels = [];
    xmlParser.parseString(data.feed.toString("utf-8"), (err, res) => {
        if (err) return;
        Subscription.findById(res.feed.entry["yt:channelId"], (err2, subscription) => {
            client.channels.fetch("730061446108676146")
                .then((channel) => {
                    channel.send(JSON.stringify(res, null, 4), {code: "json"});
                })
                .catch(chErr => {return;});
            if (err2) return;
            YT.videos.list({
                auth: config.YtApiKey,
                id: res.feed.entry["yt:videoId"],
                part: "snippet"
            }, (err3, video) => {
                if(err3 || !video) return;
                client.channels.fetch("730061446108676146")
                    .then((channel) => {
                        channel.send(JSON.stringify(video, null, 4), {code: "json"});
                    })
                    .catch(chErr => {return;});
                if(video.items[0].snippet.liveBroadcastContent !== "live") return;
                YT.channels.list({
                    auth: config.YtApiKey,
                    id: res.feed.entry["yt:channelId"],
                    part: "snippet"
                }, (err4, ytChannel) => {
                    if (err4) return;
                    for (let i = 0; i < subscription.channels.length; i++) {
                        client.channels.fetch(subscription.channels[i])
                            .then((channel) => {
                                const webhook = channel.fetchWebhooks().find(wh => wh.name.toLowerCase() === "stream notification");
                                if (!webhook) return removedChannels.push(i);
                                const embed = new Discord.MessageEmbed()
                                    .setTitle(res.feed.entry.title)
                                    .setURL(res.feed.entry.link["$"].href)
                                    .setImage(video.items[0].snippet.thumbnails.maxres.url)
                                    .setColor("#FF0000")
                                    .setFooter("Powered by Suisei's Mic")

                                webhook.send(subscription.message, {
                                    embeds: [embed],
                                    username: ytChannel.items[0].snippet.title,
                                    avatarURL: ytChannel.items[0].snippet.thumbnails.high
                                });

                            })
                            .catch((err5) => {
                                if (err5) removedChannels.push(i);
                            });
                    }
                });
            })
        });
    });
});

// Discord bot
// Create a Discord client
const client = new Discord.Client();

client.on("ready", () => {
    client.commands = new Discord.Collection(); // This holds all the commands accessible for the end users.
    client.devcmds = new Discord.Collection(); // This will hold commands that are only accessible for the maintainers
    client.staffcmds = new Discord.Collection(); // This will hold commands that are only accessible for staff
    loadcmds();
    console.log("Bot online");
});

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
        return cmd.run(client, message, args, pubHubSubscriber)
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
            return console.log("No user commands found.");
        }
        jsfiles.forEach((f, i) => {
            delete require.cache[require.resolve(`./commands/user/${f}`)];
            const cmd = require(`./commands/user/${f}`);
            client.commands.set(cmd.config.command, cmd);
        });
    });
    fs.readdir("./commands/dev", (err, files) => { // Commmands only available to the developer, these can break.
        if (err) throw (err);
        let jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return console.log("No dev commands found.");
        }
        jsfiles.forEach((f, i) => {
            delete require.cache[require.resolve(`./commands/dev/${f}`)];
            const cmd = require(`./commands/dev/${f}`);
            client.devcmds.set(cmd.config.command, cmd);
        });
    });
    fs.readdir("./commands/staff", (err, files) => { // Commmands only available to the staff
        if (err) throw (err);
        let jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return console.log("No staff commands found.");
        }
        jsfiles.forEach((f, i) => {
            delete require.cache[require.resolve(`./commands/staff/${f}`)];
            const cmd = require(`./commands/staff/${f}`);
            client.staffcmds.set(cmd.config.command, cmd);
        });
    });
}