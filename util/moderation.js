// Imports
// Packages
const moment = require("moment"),
    {scheduleJob} = require("node-schedule"),
    {MessageEmbed} = require("discord.js"),
    humanizeDuration = require("humanize-duration");

// Local files
const config = require("$/config.json");
const {client, logger} = require("$/index");

// Models
const Mute = require("$/models/activeMute"),
    LogItem = require("$/models/modLogItem"),
    Strike = require("$/models/modStrike"),
    User = require("$/models/modUser"),
    Setting = require("$/models/setting");

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
    const expirationDate = moment().add(duration, "minutes");

    const logItem = new LogItem({
        userId: member.id,
        type: "mute",
        reason: reason,
        moderator: moderator.id,
        duration: humanizeDuration(moment.duration(duration, "minutes").asMilliseconds())
    });
    logItem.save((err) => {
        if (err) return {type: "err", error: err};
        log(logItem);

        const strike = new Strike({
            _id: logItem._id,
            strikeDate: new Date()
        });
        strike.save((err) => {
            if (err) return {type: "err", error: err};
        });

        const mute = new Mute({
            _id: logItem._id,
            expireAt: expirationDate.toISOString(),
            userId: member.id
        });
        mute.save((err) => {
            if (err) return {type: "err", error: err};
        });
    });

    Setting.findById("mutedRole", async (err, doc) => {
        if (err) return {type: "err", error: err};
        if (!doc) return {type: "err", error: "noRole"}
        member.roles.add(doc.value)
            .catch((e) => {
                return {type: "err", error: e};
            });
    });

    plannedUnmutes[logItem._id] = scheduleJob(expirationDate.toDate(), () => {
        unmute(member);
    });

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

    Setting.findById("mutedRole").lean().exec((err, setting) => {
        if (err) return {type: "err", error: err};
        member.roles.add(setting.value, `Muted by ${moderator.tag} for ${humanizeDuration(moment.duration(duration, "minutes").asMilliseconds())}`);
    });

    const embed = new MessageEmbed()
        .setTitle("Mute")
        .setDescription(`You have been muted for ${humanizeDuration(moment.duration(duration, "minutes").asMilliseconds())}\nReason: ${reason}`)
        .setFooter(`Issued by: ${moderator.user.tag}`)
        .setTimestamp()

    member.send(embed)
        .catch(() => {
            return {type: "success", "info": "Failed to send DM"};
        })

    return {type: "success"};
}

function unmute(member, reason, moderator) {
    Setting.findById("mutedRole").lean().exec((err, setting) => {
        if (err) return {type: "err", error: err};
        member.roles.remove(setting.value);
        if (reason && moderator) {
            log({
                userId: member.id,
                type: "unmute",
                reason: reason,
                moderator: moderator.id
            });
        } else {
            log({
                userId: member.id,
                type: "unmute",
                reason: "Automatic unmute",
                moderator: client.user.id
            });
        }
        Mute.findOneAndDelete({userId: member.id}, (err2) => {
            if(err2) logger.error(err2);
        });
        return {type: "success"};
    });
}

exports.unmute = unmute;

exports.kick = (member, reason, moderator) => {

}

exports.ban = (member, reason, moderator) => {

}

exports.strike = (member, reason, moderator) => { // This will automatically apply the next strike

}

exports.revoke = (member, caseID, reason, moderator) => {

}

exports.getModLogsByUserID = (userID) => {

}

exports.getModLogByCaseID = (caseID) => {

}

exports.getUserData = (userID) => {

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
    client.users.fetch(logItem.userId)
        .then((offender) => {
            client.users.fetch(logItem.moderator)
                .then((moderator) => {
                    const embed = new MessageEmbed()
                        .setTitle(`${logItem.type}${logItem._id ? ` | case ${logItem._id}` : ""}`)
                        .setDescription(`**Offender:** ${offender.tag}${logItem.duration ? `\n**Duration:** ${logItem.duration}` : ""}\n**Reason:** ${logItem.reason}\n**Moderator:** ${moderator.tag}`)
                        .setFooter(logItem.userId)
                        .setTimestamp();
                    Setting.findById("modLogChannel", (err, doc) => {
                        if (err) return logger.error(err);
                        if (!doc) return;
                        client.channels.fetch(doc.value)
                            .then((channel) => {
                                channel.send(embed);
                            });
                    })
                });
        });
}

exports.log = log;

exports.init = function () { // Should run on every bot start
    Mute.find({}, (err, docs) => {
        if (err) return logger.error(err);
        docs.forEach((doc) => {
            LogItem.findById(doc._id, (err2, logDoc) => {
                if (err2) return logger.error(err2);
                client.guilds.fetch(config.discord.serverId)
                    .then((guild) => {
                        guild.members.fetch(logDoc.userId)
                            .then((member) => {
                                plannedUnmutes[doc._id] = scheduleJob(new Date(doc.expirationDate), () => {
                                    unmute(member);
                                });
                            })
                            .catch((e) => {
                                logger.error(e);
                            });
                    })
                    .catch((e) => {
                        logger.error(e);
                    });
            })
        })
    });
}