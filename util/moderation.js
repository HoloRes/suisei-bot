// Imports
// Packages
const moment = require("moment"),
    {scheduleJob} = require("node-schedule"),
    {MessageEmbed} = require("discord.js");

// Local files
const config = require("$/config.json");
const {client} = require("$/index");

// Models
const Mute = require("$/models/activeMute"),
    LogItem = require("$/models/modLogItem"),
    Strike = require("$/models/modStrike"),
    User = require("$/models/modUser"),
    Setting = require("$/models/Setting");

// Init
let plannedUnmutes = {};

// Exports
exports.warn = (member, reason, moderator) => {
    const logItem = new LogItem({
        userId: member.id,
        type: "warn",
        reason: reason,
        moderator: moderator.id
    });
    logItem.save((err) => {
        if (err) return {type: "err", error: err};
    });
    log(logItem);

    User.findById(member.id, (err, doc) => {
        if (err) return {type: "err", error: err};
        if (!doc) {
            const user = new User({
                _id: member.id,
                lastKnownTag: member.user.tag
            });
            user.save((err) => {
                if (err) return {type: "err", error: err};
            });
        } else {
            doc.lastKnownTag = member.user.tag;
            doc.save((err) => {
                if (err) return {type: "err", error: err};
            });
        }
    });

    const embed = new MessageEmbed()
        .setTitle("Warn")
        .setDescription(`You have been warned for: ${reason}\n\nNote: Warns do **NOT** count as strikes`)
        .setFooter(`Issued by: ${moderator.user.tag}`)
        .setTimestamp()

    member.send(embed)
        .catch(() => {
            return {type: "success", "info": "Failed to send DM"};
        })

    return {type: "success"};
}

exports.mute = (member, duration, reason, moderator) => {
    // TODO: Add role to member, with try catch block
    // Duration must be in minutes
    const expirationDate = moment().add(duration, "minutes");

    const logItem = new LogItem({
        userId: member.id,
        type: "mute",
        reason: reason,
        moderator: moderator.id,
        duration: moment.duration(duration, "minutes").humanize()
    });
    logItem.save((err) => {
        if (err) return {type: "err", error: err};
    });
    log(logItem);

    const mute = new Mute({
        _id: logItem._id,
        expireAt: expirationDate
    });
    mute.save((err) => {
        if (err) return {type: "err", error: err};
    });

    const strike = new Strike({
        _id: logItem._id,
        strikeDate: new Date(Date.now()).toISOString()
    });
    strike.save((err) => {
        if (err) return {type: "err", error: err};
    });

    Setting.findById("mutedRole", async (err, doc) => {
        if (err) return {type: "err", error: err};
        if(!doc) return {type: "err", error: "noRole"}
        member.roles.add(doc.value)
            .catch((e) => {
                return {type: "err", error: e};
            });
    });

    plannedUnmutes[logItem._id] = scheduleJob(expirationDate, () => {
        unmute(member, "Automatic unmute", client.user.tag)
    });

    User.findById(user.id, (err, doc) => {
        if (err) return {type: "err", error: err};
        if (!doc) {
            const user = new User({
                _id: member.id,
                lastKnownTag: member.user.tag
            });
            user.save((err) => {
                if (err) return {type: "err", error: err};
            });
        } else {
            doc.lastKnownTag = member.user.tag;
            doc.save((err) => {
                if (err) return {type: "err", error: err};
            });
        }
    });

    Setting.findById("mutedRole").lean().exec((err, setting) => {
        if (err) return {type: "err", error: err};
        member.roles.add(setting.value, `Muted by ${moderator.tag} for ${moment.duration(duration, "minutes").humanize()}`);
    });

    return {type: "success"};
}

function unmute(user, reason, moderator) {

}
exports.unmute = unmute;

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

exports.getMemberFromMessage = (message, args, next) => { // TODO: Check if member is a moderator or bot
    if (message.mentions.members.size === 1) {
        return next(message.mentions.members.array()[0]);
    } else {
        message.guild.members.fetch(args[0])
            .then((member) => {
                return next(member);
            })
            .catch(() => {
                message.guild.members.fetch()
                    .then(() => {
                        const member = message.guild.members.cache.find(guildMember => guildMember.user.tag.toLowerCase() === args[0].toLowerCase());
                        if (!member) return message.channel.send("Cannot find this user.")
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

exports.init = function () { // Should run on every bot start
    Mute.find({}, (err, docs) => {
        // TODO: Schedule unmute (role removal and db document removal)
    });
}