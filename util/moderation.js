// Imports
// Packages
const {client} = require("$/index");

// Local files
const config = require("$/config.json")

// Init

// Exports
exports.warn = (user, reason, moderator) => {

}

exports.mute = (user, strike, duration, reason, moderator) => {

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

}