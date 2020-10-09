// Imports
// Packages
const Discord = require("discord.js"),
    { Client: ElasticClient } = require("@elastic/elasticsearch");

// Local files
const config = require("$/config.json")

// Init
const elasticClient = new ElasticClient({ node: config.elasticUrl });

// Exports
exports.warn = (user, strike, reason, moderator) => {



}

exports.mute = (user, reason, moderator) => {

}

exports.kick = (user, reason, moderator) => {

}

exports.ban = (user, reason, moderator) => {

}

exports.strike = (user, reason, moderator) => { // This will automatically apply the next strike

}

exports.getModLogByUserID = (user) => {

}

exports.getModLogByCaseID = (caseID) => {

}

exports.getMemberFromMessage = (message, args, next) => {
    if(message.mentions.members.size === 1) {
        return next(message.mentions.members.array()[0]);
    } else {
        message.guild.members.fetch(args[0])
            .then((member) => {
                return next(member);
            })
            .catch((e) => {
                if(e) message.guild.members.fetch()
                    .then(() => {
                        const member = message.guild.members.cache.find(guildMember =>  guildMember.user.tag.toLowerCase() === args[0].toLowerCase());
                        if(!member) return message.channel.send("Cannot find this user.")
                            .then(msg => {
                                message.delete({timeout: 4000, reason: "Automated"});
                                msg.delete({timeout: 4000, reason: "Automated"});
                            });
                        return next(member);
                    });
            })
    }
}

exports.firstInit = function () { // This should run when the Elasticsearch node hasn't been set up beforehand
    elasticClient.indices.create({ index: "strikes" }); // Documents in this should auto delete after a month
    elasticClient.indices.create({ index: "bans" });
    elasticClient.indices.create({ index: "mutes" }); // This index is here to make searches less expensive
    elasticClient.indices.create({ index: "moderation" }); // This will hold all moderation actions, including expired strikes
}