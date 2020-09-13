// Models
const Subscription = require("$/models/subscription");

// Local files
const config = require("$/config.json"),
    {confirmRequest} = require("$/util/functions"),
    {planLivestreams} = require("$/index");

// Modules
const Discord = require("discord.js"),
    {google} = require("googleapis");

// Init
const YT = google.youtube("v3");

exports.run = (client, message, args) => {
    if(!args[0]) return message.channel.send("**Usage:** [subscribe <youtube channel id> <discord channel id> <message>")
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    YT.channels.list({
        auth: config.YtApiKey,
        id: args[0],
        part: "snippet"
    }, (err, res) => {
        if (err) return message.channel.send("Something went wrong, try again later.")
            .then(msg => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });

        if (res.data.pageInfo.totalResults === 0) {
            message.channel.send("That is an invalid channel id.").then((msg) => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });
        } else {
            client.channels.fetch(args[1])
                .then(async (channel) => {
                    let subscription = new Subscription({
                        _id: res.data.items[0].id,
                        channels: [{
                            id: channel.id,
                            message: args.slice(2).join(" ")
                        }]
                    });

                    await channel.fetchWebhooks()
                        .then(async (hooks) => {
                            const existingWebhook = await hooks.find(wh => wh.name.toLowerCase() === "stream notification");
                            if (!existingWebhook) channel.createWebhook("Stream notification")
                                .then((webhook) => {
                                    checkExistingAndSubscribe(message, subscription, webhook, res, channel, args.slice(2).join(" "));
                                })
                                .catch((err) => {
                                    if (err) {
                                        return message.channel.send("Unable to create a webhook in that channel, please create one with the name `Stream notification`").then((msg) => {
                                            message.delete({timeout: 4000, reason: "Automated"});
                                            msg.delete({timeout: 4000, reason: "Automated"});
                                        });
                                    }
                                });
                            else checkExistingAndSubscribe(message, subscription, existingWebhook, res, channel, args.slice(2).join(" "));
                        });
                })
                .catch((err) => {
                    if (err) {
                        message.channel.send("That channel doesn't exist.").then((msg) => {
                            message.delete({timeout: 4000, reason: "Automated"});
                            msg.delete({timeout: 4000, reason: "Automated"});
                        });
                    }
                });
        }
    });
}

function checkExistingAndSubscribe(message, subscription, wh, res, channel, channelMsg) {
    Subscription.findById(subscription._id, (err, sub) => {
        if (!err) {
            if (sub) {
                sub.channels.push({
                    id: channel.id,
                    message: channelMsg
                });
                return message.channel.send(`Are you sure you want to add ${res.data.items[0].snippet.title} to ${channel.name}?`)
                    .then(msg => {
                        confirmRequest(msg, message.author.id)
                            .then(result => {
                                msg.delete({reason: "Automated"})
                                if (result === true) {
                                    sub.save((err) => {
                                        if (err) message.channel.send("Something went wrong saving to the database.")
                                            .then(msg2 => {
                                                message.delete({timeout: 4000, reason: "Automated"});
                                                msg2.delete({timeout: 4000, reason: "Automated"});
                                            });
                                        else message.channel.send("Subscription successful.")
                                            .then(msg2 => {
                                                message.delete({timeout: 4000, reason: "Automated"});
                                                msg2.delete({timeout: 4000, reason: "Automated"});
                                            });
                                    });
                                }
                            });
                    });
            } else {
                const embed = new Discord.MessageEmbed()
                    //.setTitle("Playing: A Game")
                    .setTitle("Stream title")
                    .setImage("https://cdn.discordapp.com/attachments/730061446108676146/741281514091708537/Example_thumbnail.png")
                    .setColor("#FF0000")
                    .setFooter("Powered by Suisei's Mic")

                wh.send(channelMsg, {
                    embeds: [embed],
                    disableMentions: true,
                    username: res.data.items[0].snippet.title,
                    avatarURL: res.data.items[0].snippet.thumbnails.high.url
                }).then((exampleEmbed) => {
                    message.channel.send("Is this correct?").then((msg) => {
                        confirmRequest(msg, message.author.id)
                            .then(result => {
                                if (result === true) {
                                    exampleEmbed.delete({reason: "Automated"});
                                    msg.delete({timeout: 2000, reason: "Automated"});
                                    subscription.save((err) => {
                                        if (err) message.channel.send("Something went wrong during the subscription, try again later.")
                                            .then(msg2 => {
                                                message.delete({timeout: 4000, reason: "Automated"});
                                                msg2.delete({timeout: 4000, reason: "Automated"});
                                            });
                                        else {
                                            planLivestreams(subscription._id)
                                            message.channel.send("Subscription successful.")
                                                .then(msg2 => {
                                                    message.delete({timeout: 4000, reason: "Automated"});
                                                    msg2.delete({timeout: 4000, reason: "Automated"});
                                                });
                                        }
                                    });
                                } else {
                                    msg.edit("Cancelled.");
                                    exampleEmbed.delete({reason: "Automated"});
                                    msg.delete({timeout: 4000, reason: "Automated"});
                                    message.delete({timeout: 4000, reason: "Automated"});
                                }
                            });
                    });
                });
            }
        }
    });
}

module.exports.config = {
    command: "subscribe"
}
