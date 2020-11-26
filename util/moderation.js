// Imports
// Packages
const {client} = require("$/index");

// Local files
const config = require("$/config.json")

// Models
const Mute = require("$/models/activeMute"),
    LogItem = require("$/models/modLogItem"),
    Strike = require("$/models/modStrike"),
    User = require("$/models/modUser");

// Init

// Exports
exports.warn = (user, reason, moderator) => {
    const logItem = new LogItem({
        userId: user.id,
        type: "warn",
        reason: reason,
        moderator: moderator.id
    });
    logItem.save((err) => {
        if(err) return {type: "err", error: err};
    });

    User.findById(user.id, (err, doc) => {
        if(err) return {type: "err", error: err};
        if(!doc) {
            const user = new User({
                _id: user.id,
                lastKnownTag: user.tag
            });
            user.save((err) => {
                if(err) return {type: "err", error: err};
            });
        } else {
            doc.lastKnownTag = user.tag;
            doc.save((err) => {
                if(err) return {type: "err", error: err};
            });
        }
    });
    return {type: "success"};
}

exports.mute = (user, isStrike, duration, reason, moderator) => {
    const expirationDate = new Date();
    // TODO: Use moment.js to calculate expiration

    const logItem = new LogItem({
        userId: user.id,
        type: "mute",
        reason: reason,
        moderator: moderator.id,
        duration: duration // TODO: Use moment-timezone to convert to human readable string
    });
    logItem.save((err) => {
        if(err) return {type: "err", error: err};
    });

    const mute = new Mute({
        _id: logItem._id,
        expireAt: expirationDate
    });
    mute.save((err) => {
        if(err) return {type: "err", error: err};
    });

    if(isStrike) {
        const strike = new Strike({
            _id: logItem._id,
            strikeDate: new Date(Date.now()).toISOString()
        });
        strike.save((err) => {
            if(err) return {type: "err", error: err};
        });
    }

    User.findById(user.id, (err, doc) => {
        if(err) return {type: "err", error: err};
        if(!doc) {
            const user = new User({
                _id: user.id,
                lastKnownTag: user.tag
            });
            user.save((err) => {
                if(err) return {type: "err", error: err};
            });
        } else {
            doc.lastKnownTag = user.tag;
            doc.save((err) => {
                if(err) return {type: "err", error: err};
            });
        }
    });
    return {type: "success"};
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
            });
    }
}

exports.firstInit = function () { // This should run when the Elasticsearch node hasn't been set up beforehand

}