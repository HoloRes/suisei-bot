// Models
const Subscription = require("$/models/subscription");

// Local files
const config = require("$/config.json"),
    {confirmRequest} = require("$/util/functions");

// Modules
const Discord = require("discord.js"),
    {google} = require("googleapis");

// Init
const YT = google.youtube("v3");

exports.run = (client, message, args, pubSubSubscriber) => {
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
                .then((channel) => {
                    let subscription = new Subscription({
                        _id: res.data.items[0].id,
                        channels: [channel.id],
                        message: args.slice(2).join(" ")
                    });

                    let wh = channel.fetchWebhooks().find(wh => wh.name.toLowerCase() === "stream notification");
                    if (!wh) channel.createWebhook("Stream notification")
                        .then((webhook) => {
                            wh = webhook;
                        })
                        .catch(() => {
                            return message.channel.send("Unable to create a webhook in that channel, please create one with the name `Stream notification`").then((msg) => {
                                message.delete({timeout: 4000, reason: "Automated"});
                                msg.delete({timeout: 4000, reason: "Automated"});
                            });
                        });

                    Subscription.findById(subscription._id, (err, sub) => {
                        if (!err) {
                            sub.channels.push(channel.id);
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
                        }
                    });

                    const embed = new Discord.MessageEmbed()
                        //.setTitle("Playing: A Game")
                        .setTitle("Stream title")
                        .setImage("https://cdn.discordapp.com/attachments/730061446108676146/741281514091708537/Example_thumbnail.png")
                        .setColor("#FF0000")
                        .setFooter("Powered by Suisei's Mic")

                    wh.send(subscription.message, {
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
                                        pubSubSubscriber.subscribe(
                                            `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${subscription._id}`,
                                            "https://pubsubhubbub.appspot.com",
                                            (err) => {
                                                if (err) message.channel.send("Something went wrong during the subscription, try again later.")
                                                    .then(msg2 => {
                                                        message.delete({timeout: 4000, reason: "Automated"});
                                                        msg2.delete({timeout: 4000, reason: "Automated"});
                                                    });
                                                else subscription.save((err2) => {
                                                    if (err2) message.channel.send("Something went wrong during the subscription, try again later.")
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
                                        )
                                    }
                                });
                        });
                    });
                })
                .catch(() => {
                    message.channel.send("That channel doesn't exist.").then((msg) => {
                        message.delete({timeout: 4000, reason: "Automated"});
                        msg.delete({timeout: 4000, reason: "Automated"});
                    });
                });
        }
    });
}

module.exports.config = {
    command: "subscribe"
}
