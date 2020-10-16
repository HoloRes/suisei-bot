// Imports
// Models
const TweetSubscription = require("$/models/tweetSubscription");

// Packages
const Twitter = require("twitter-lite");

// Local imports
const config = require("$/config.json"),
    {confirmRequest} = require("$/util/functions"),
    {restart} = require("$/util/twitter");

// Variables
const T = new Twitter(config.twitter);

exports.run = async (client, message, args) => {
    if (!args[0] || !args[1]) return message.channel.send(`**USAGE:** ${config.discord.prefix}unfollow <Twitter @name (without @)> <Discord channel id>`)
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

    TweetSubscription.findById(users[0].id_str, (err, doc) => {
        if (err) return message.channel.send("Something went wrong, try again later.")
            .then(msg => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });

        if (!doc) return message.channel.send("That Twitter account doesn't exist in the database.")
            .then(msg => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });

        let index = doc.channels.findIndex(channel => channel.id === args[1]);
        if (index === -1) return message.channel.send("That text channel isn't following this Twitter user.")
            .then(msg => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });

        doc.channels.splice(index, 1);
        message.channel.send(`Are you sure you want to remove \@${args[0]} from ${args[1]}?`)
            .then(msg => {
                confirmRequest(msg, message.author.id)
                    .then(result => {
                        msg.delete({reason: "Automated"});
                        if (result === true) {
                            if (doc.channels.length === 0) {
                                doc.findByIdAndDelete(doc._id, (err) => {
                                    if (err) message.channel.send("Something went wrong during deletion, try again later.")
                                        .then(msg => {
                                            message.delete({timeout: 4000, reason: "Automated"});
                                            msg.delete({timeout: 4000, reason: "Automated"});
                                        });
                                    else {
                                        restart();
                                        message.channel.send("Unfollow successful.")
                                            .then(msg2 => {
                                                message.delete({timeout: 4000, reason: "Automated"});
                                                msg2.delete({timeout: 4000, reason: "Automated"});
                                            });
                                    }
                                });
                            } else {
                                doc.save((err) => {
                                    if (err) message.channel.send("Something went wrong during unfollowing, try again later.")
                                        .then(msg2 => {
                                            message.delete({timeout: 4000, reason: "Automated"});
                                            msg2.delete({timeout: 4000, reason: "Automated"});
                                        });
                                    else message.channel.send("Unfollow successful.")
                                        .then(msg2 => {
                                            message.delete({timeout: 4000, reason: "Automated"});
                                            msg2.delete({timeout: 4000, reason: "Automated"});
                                        });
                                })
                            }
                        }
                    });
            });
    });
}

exports.config = {
    command: "unfollow"
}