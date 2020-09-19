// Imports
// Models
const TweetSubscription = require("$/models/tweetSubscription");

// Packages
const Twitter = require("twitter-lite");

// Local imports
const {confirmRequest} = require("$/util/functions"),
    {restart} = require("$/util/twitter"),
    config = require("$/config.json");

// Variables
const T = new Twitter(config.twitter);

exports.run = async (client, message, args) => {
    if(!args[0]) return message.channel.send(`**USAGE:** ${config.discord.staffprefix}follow <Twitter @name (without @)> <Discord channel id>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    const users = await T.get("users/lookup", { screen_name: args[0] })
        .catch((e) => {
            if(e) return message.channel.send("Couldn't find this user, please try again.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
        });

    if(!users[0]) return message.channel.send("Couldn't find this user, please try again.")
        .then((msg) => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

    await client.channels.fetch(args[1])
        .then(async (channel) => {
            let subscription = new TweetSubscription({
                _id: users[0].id_str,
                channels: [args[1]]
            });

            await channel.fetchWebhooks()
                .then(async (hooks) => {
                    const existingWebhook = await hooks.find(wh => wh.name.toLowerCase() === "holotweeter");
                    if (!existingWebhook) channel.createWebhook("HoloTweeter")
                        .then((webhook) => {
                            checkExistingAndFollow(message, subscription, webhook, users[0]);
                        })
                        .catch((err) => {
                            if (err) {
                                return message.channel.send("Unable to create a webhook in that channel, please create one with the name `HoloTweeter` and run this command again.").then((msg) => {
                                    message.delete({timeout: 4000, reason: "Automated"});
                                    msg.delete({timeout: 4000, reason: "Automated"});
                                });
                            }
                        });
                    else checkExistingAndFollow(message, subscription, existingWebhook, users[0]);
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

function checkExistingAndFollow(message, subscription, wh, user) {
    TweetSubscription.findById(subscription._id, (err, doc) => {
        if(!err) {
            if(doc) {
                subscription.channels.push(channel.id);
                return message.channel.send(`Are you sure you want to add \@${user.screen_name} to ${channel.name}?`)
                    .then((msg) => {
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
                                } else {
                                    message.channel.send("Cancelled.")
                                        .then(msg2 => {
                                            message.delete({timeout: 4000, reason: "Automated"});
                                            msg2.delete({timeout: 4000, reason: "Automated"});
                                        });
                                }
                            });
                    });
            } else {
                wh.send("Tweet url", {
                    username: `\@${user.screen_name}`,
                    avatarURL: user.profile_image_url_https.substring(0, user.profile_image_url_https.length - "normal.jpg".length) + "400x400.jpg"
                }).then((exampleMsg) => {
                    message.channel.send("Is this correct?").then((msg) => {
                        confirmRequest(msg, message.author.id)
                            .then(result => {
                                if (result === true) {
                                    exampleMsg.delete({reason: "Automated"});
                                    msg.delete({timeout: 2000, reason: "Automated"});
                                    subscription.save((err) => {
                                        if (err) message.channel.send("Something went wrong during the subscription, try again later.")
                                            .then(msg2 => {
                                                message.delete({timeout: 4000, reason: "Automated"});
                                                msg2.delete({timeout: 4000, reason: "Automated"});
                                            });
                                        else {
                                            restart();
                                            message.channel.send("Subscription successful.")
                                                .then(msg2 => {
                                                    message.delete({timeout: 4000, reason: "Automated"});
                                                    msg2.delete({timeout: 4000, reason: "Automated"});
                                                });
                                        }
                                    });
                                } else {
                                    msg.edit("Cancelled.");
                                    exampleMsg.delete({reason: "Automated"});
                                    msg.delete({timeout: 4000, reason: "Automated"});
                                    message.delete({timeout: 4000, reason: "Automated"});
                                }
                            });
                    });
                });
            }
        }
    })
}

exports.config = {
    command: "follow"
}