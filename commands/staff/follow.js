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

exports.run = (client, message, args) => {

}

exports.config = {
    command: "follow"
}