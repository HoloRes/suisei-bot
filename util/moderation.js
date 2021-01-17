// Imports
// Packages
const moment = require("moment");

// Local files
const config = require("$/config.json")
const {client} = require("$/index");

// Models
const Mute = require("$/models/activeMute"),
    LogItem = require("$/models/modLogItem"),
    Strike = require("$/models/modStrike"),
    User = require("$/models/modUser"),
    Setting = require("$/models/Setting");

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

exports.mute = (user, duration, reason, moderator) => {
    // TODO: Use node-schedule or node-cron to schedule the unmute
    // Duration must be in minutes
    const expirationDate = moment().add(duration, "minutes");

    const logItem = new LogItem({
        userId: user.id,
        type: "mute",
        reason: reason,
        moderator: moderator.id,
        duration: moment.duration(duration, "minutes").humanize()
    });
    logItem.save((err) => {
        if(err) return {type: "err", error: err};
    });
    log(logItem);

    const mute = new Mute({
        _id: logItem._id,
        expireAt: expirationDate
    });
    mute.save((err) => {
        if(err) return {type: "err", error: err};
    });

    const strike = new Strike({
        _id: logItem._id,
        strikeDate: new Date(Date.now()).toISOString()
    });
    strike.save((err) => {
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

    Setting.findById("mutedRole").lean().exec((err, setting) => {
        if(err) return {type: "err", error: err};
        user.roles.add(setting.value, `Muted by ${moderator.tag} for ${moment.duration(duration, "minutes").humanize()}`);
    });

    return {type: "success"};
}

exports.kick = (user, reason, moderator) => {

}

exports.ban = (user, reason, moderator) => {

}

exports.strike = (user, reason, moderator) => { // This will automatically apply the next strike

}

exports.revoke = (user, caseID, reason, moderator) => {

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

function log(logItem) {
    // TODO: Publish to log channel
}

exports.log = log;

exports.firstInit = function () { // This should run when the Elasticsearch node hasn't been set up beforehand

}