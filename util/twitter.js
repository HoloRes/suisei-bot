// Imports
// Models
const TweetSubscription = require("$/models/tweetSubscription");

// Packages
const Discord = require("discord.js"),
    {scheduleJob} = require("node-schedule"),
    Twitter = require("twitter-lite");

// Local imports
const {logger, client} = require("$/index"),
    config = require("$/config.json");

// Variables
const T = new Twitter(config.twitter);
let stream = null;

// Exports
function start(logger) {
    let users = "";
    TweetSubscription.find({}, async (err, docs) => {
        if(err) return logger.error(err);
        if(docs.length === 0) return logger.verbose("Not following any Twitter users.");
        for(let i = 0; i < docs.length; i++) users = `${users},${docs[i]._id}`
        stream = await T.stream("statuses/filter", { follow: users });
        stream.on("data", (tweet) => {
            TweetSubscription.findById(tweet.user.id_str, (err2, doc) => {
                if(!doc) return;
                if(err2) return logger.error(err2);
                for(let i = 0; i < doc.channels.length; i++) {
                    client.channels.fetch(doc.channels[i])
                        .then((channel) => {
                            channel.fetchWebhooks()
                                .then((hooks) => {
                                    logger.debug("Trying to find Twitter webhook")
                                    const webhook = hooks.find(wh => wh.name.toLowerCase() === "holotweeter");
                                    if(!webhook) logger.verbose(`Cannot find Twitter webhook in ${channel.id}`);
                                    else {
                                        logger.debug("Trying to send Twitter message");
                                        webhook.send(`https://twitter.com/${tweet.user.id_str}/status/${tweet.id_str}`, {
                                            username: `\@${tweet.user.screen_name}`,
                                            avatarURL: tweet.user.profile_image_url_https.substring(0, tweet.user.profile_image_url_https.length - "normal.jpg".length) + "400x400.jpg"
                                        });
                                    }
                                });
                        })
                        .catch((err3) => {
                            logger.error(err3);
                        });
                }
            });
        });
    });

    scheduleJob("0 0 * * 0", () => { // Automatically restart the client every Sunday
        if (stream) stream.destroy();
        setTimeout(() => {start()}, 2000);
    });
}
exports.init = start;

exports.restart = function () {
    if(stream) stream.destroy();
    setTimeout(() => {start()}, 2000);
}