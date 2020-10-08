// Imports
// Packages
const Discord = require("discord.js"),
    { Client: ElasticClient } = require("@elastic/elasticsearch");

// Local files
const config = require("$/config.json")

// Init
const elasticClient = new ElasticClient({ node: config.elasticUrl });

// Exports
exports.warn = (user, strike, reason) => {



}

exports.mute = (user, reason) => {

}

exports.kick = (user, reason) => {

}

exports.ban = (user, reason) => {

}

exports.strike = (user, reason) => { // This will automatically apply the next strike

}

exports.getModLogByUserID = (user) => {

}

exports.getModLogByCaseID = (caseID) => {

}

exports.firstInit = function () { // This should run when the Elasticsearch node hasn't been set up beforehand
    elasticClient.indices.create({ index: "strikes" }); // Documents in this should auto delete after a month
    elasticClient.indices.create({ index: "bans" });
    elasticClient.indices.create({ index: "mutes" }); // This index is here to make searches less expensive
    elasticClient.indices.create({ index: "moderation" }); // This will hold all moderation actions, including expired strikes
}