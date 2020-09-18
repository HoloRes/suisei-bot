// Imports
// Models
const TweetSubscription = require("$/models/tweetSubscription");

// Packages
const Discord = require("discord.js"),
    Twitter = require("twitter-lite");

// Local imports
const {logger, client} = require("$/index"),
    config = require("$/config.json");

// Variables
const T = new Twitter(config.twitter);

// Init
exports.init = function () {
    let users = "";
    TweetSubscription.find({}, async (err, docs) => {
        if(err) return logger.error(err);
        for(let i = 0; i < docs.length; i++) users = `${users},${docs[i]._id}`
        const stream = await T.stream("statuses/filter", { follow: users });
        stream.on("data", (tweet) => {
            logger.debug(tweet);
            // TweetSubscription.findById(/* TODO: Need to figure out how to get user id from the stream response */"", (err2, subscription) => {
            //     if(err2) return logger.error(err2);
            //     client.channels.fetch(subscription.channelID)
            //         .then((channel) => {
            //             channel.fetchWebhooks()
            //                 .then((hooks) => {
            //                     logger.debug("Trying to find webhook")
            //                     const webhook = hooks.find(wh => wh.name.toLowerCase() === "holotweeter");
            //                     logger.debug("Trying to send message");
            //                     webhook.send(/* TODO: Tweet URL */"", {
            //                         username: /* TODO: Tweet user !screen name! */ "",
            //                         avatarURL: /* TODO: Tweet user avatar */""
            //                     })
            //                 });
            //         })
            //         .catch((err3) => {
            //             logger.error(err3);
            //         });
            // });
        });
    });
}

// Code

