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
    return new Promise(async (resolve, reject) => {
        const logItem = new LogItem({
            userId: member.id,
            type: "warn",
            reason: reason,
            moderator: moderator.id
        });
        await logItem.save((err) => {
            if (err) reject({type: "err", error: err});
            log(logItem, "#f54242");
        });

        updateMember(member);

        const embed = new MessageEmbed()
            .setTitle("Warn")
            .setDescription(`You have been warned for: ${reason}\n\nNote: Warns do **NOT** count as strikes`)
            .setFooter(`Issued by: ${moderator.user.tag}`)
            .setTimestamp()

        await member.send(embed)
            .catch(() => {
                resolve({type: "success", info: "failed to send DM"});
            })

        resolve({type: "success"});
    });
}

exports.mute = (member, duration, reason, moderator) => {
    return new Promise(async (resolve, reject) => {
        const expirationDate = moment().add(duration, "minutes");

        const logItem = new LogItem({
            userId: member.id,
            type: "mute",
            reason: reason,
            moderator: moderator.id,
            duration: humanizeDuration(moment.duration(duration, "minutes").asMilliseconds())
        });
        await logItem.save((err) => {
            if (err) reject({type: "err", error: err});
            log(logItem, "#f54242");

            const strike = new Strike({
                _id: logItem._id,
                strikeDate: new Date()
            });
            strike.save((err) => {
                if (err) reject({type: "err", error: err});
            });

            const mute = new Mute({
                _id: logItem._id,
                expireAt: expirationDate.toISOString(),
                userId: member.id
            });
            mute.save((err) => {
                if (err) reject({type: "err", error: err});
            });

            plannedUnmutes[logItem._id] = scheduleJob(expirationDate.toDate(), () => {
                unmute(member);
            });
        });

        await Setting.findById("mutedRole", async (err, doc) => {
            if (err) reject({type: "err", error: err});
            if (!doc) reject({type: "err", error: "noRole"});
            member.roles.add(doc.value)
                .catch((e) => {
                    reject({type: "err", error: e});
                });
        });

        updateMember(member);

        await Setting.findById("mutedRole").lean().exec((err, setting) => {
            if (err) reject({type: "err", error: err});
            member.roles.add(setting.value, `Muted by ${moderator.tag} for ${humanizeDuration(moment.duration(duration, "minutes").asMilliseconds())}`);
        });

        const embed = new MessageEmbed()
            .setTitle("Mute")
            .setDescription(`You have been muted for ${humanizeDuration(moment.duration(duration, "minutes").asMilliseconds())}\nReason: ${reason}`)
            .setFooter(`Issued by: ${moderator.user.tag}`)
            .setTimestamp()

        await member.send(embed)
            .catch(() => {
                resolve({type: "success", info: "failed to send DM"});
            })

        resolve({type: "success"});
    });
}

function unmute(member, reason, moderator) {
    return new Promise((resolve, reject) => {
        Setting.findById("mutedRole").lean().exec((err, setting) => {
            if (err) reject({type: "err", error: err});
            member.roles.remove(setting.value);
            if (reason && moderator) {
                log({
                    userId: member.id,
                    type: "unmute",
                    reason: reason,
                    moderator: moderator.id
                }, "#2bad64");
            } else {
                log({
                    userId: member.id,
                    type: "unmute",
                    reason: "Automatic unmute",
                    moderator: client.user.id
                }, "#2bad64");
            }
            Mute.findOneAndDelete({userId: member.id}, (err2, doc) => {
                if (err2) logger.error(err2);
                if (doc && plannedUnmutes[doc._id]) plannedUnmutes[doc._id].cancel();
            });
            resolve({type: "success"});
        });
    });
}

exports.unmute = unmute;

exports.kick = (member, reason, moderator) => {
    return new Promise(async (resolve, reject) => {
        const logItem = new LogItem({
            userId: member.id,
            type: "kick",
            reason: reason,
            moderator: moderator.id
        });
        await logItem.save((err) => {
            if (err) reject({type: "err", error: err});
            log(logItem, "#f54242");

            const strike = new Strike({
                _id: logItem._id,
                strikeDate: new Date()
            });
            strike.save((err) => {
                if (err) reject({type: "err", error: err});
            });
        });

        updateMember(member);

        const embed = new MessageEmbed()
            .setTitle("Kick")
            .setDescription(`You have been kicked for: ${reason}`)
            .setFooter(`Issued by: ${moderator.user.tag}`)
            .setTimestamp()

        await member.send(embed)
            .catch(() => {
                resolve({type: "success", info: "failed to send DM"});
            })

        await member.kick(reason)
            .catch((err) => {
                reject({type: "err", error: err});
            });

        resolve({type: "success"});
    });
}

exports.ban = (member, reason, moderator) => {
    return new Promise(async (resolve, reject) => {
        const logItem = new LogItem({
            userId: member.id,
            type: "ban",
            reason: reason,
            moderator: moderator.id
        });
        await logItem.save((err) => {
            if (err) reject({type: "err", error: err});
            log(logItem, "#f54242");

            const strike = new Strike({
                _id: logItem._id,
                strikeDate: new Date()
            });
            strike.save((err) => {
                if (err) reject({type: "err", error: err});
            });
        });

        updateMember(member);

        const embed = new MessageEmbed()
            .setTitle("Ban")
            .setDescription(`You have been banned for: ${reason}`)
            .setFooter(`Issued by: ${moderator.user.tag}`)
            .setTimestamp()

        await member.send(embed)
            .catch(() => {
                resolve({type: "success", info: "failed to send DM"});
            })

        await member.ban({reason})
            .catch((err) => {
                reject({type: "err", error: err});
            });

        resolve({type: "success"});
    });
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

exports.getMemberFromMessage = (message, args) => {
    return new Promise((resolve, reject) => {
        if (message.mentions.members.size > 0) {
            resolve(message.mentions.members.array()[0]);
        } else {
            message.guild.members.fetch(args[0])
                .then((member) => {
                    if (member.hasPermission("MANAGE_GUILD")) reject("This member is a moderator")
                    if (member.user.bot) reject("This user is a bot")
                    resolve(member);
                })
                .catch(() => {
                    message.guild.members.fetch()
                        .then(() => {
                            const member = message.guild.members.cache.find(guildMember => guildMember.user.tag.toLowerCase() === args[0].toLowerCase());
                            if (!member) reject("Member not found");
                            return resolve(member);
                        });
                });
        }
    });
}

function log(logItem, color) {
    client.users.fetch(logItem.userId)
        .then((offender) => {
            client.users.fetch(logItem.moderator)
                .then((moderator) => {
                    const embed = new MessageEmbed()
                        .setTitle(`${logItem.type}${logItem._id ? ` | case ${logItem._id}` : ""}`)
                        .setDescription(`**Offender:** ${offender.tag}${logItem.duration ? `\n**Duration:** ${logItem.duration}` : ""}\n**Reason:** ${logItem.reason}\n**Moderator:** ${moderator.tag}`)
                        .setFooter(`ID: ${logItem.userId}`)
                        .setColor(color)
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
                                    unmute(member)
                                        .catch((e) => {
                                            logger.error(e);
                                        });
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

function updateMember(member) {
    User.findById(member.id, (err, doc) => {
        if (err) logger.error(err);
        else {
            if (!doc) {
                const user = new User({
                    _id: member.id,
                    lastKnownTag: member.user.tag
                });
                user.save((err) => {
                    if (err) logger.error(err);
                });
            } else {
                doc.lastKnownTag = member.user.tag;
                doc.save((err) => {
                    if (err) logger.error(err);
                });
            }
        }
    });
}