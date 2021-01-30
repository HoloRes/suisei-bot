// Imports
// Packages
const config = require("$/config.json");

// Local files
const moderation = require("$/util/moderation");

// Models
const Setting = require("$/models/setting");

exports.run = async (client, message, args) => {
    if(args.length < 1) return message.channel.send(`**USAGE:** ${config.discord.prefix}unmute <user> <reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

    const reason = (args[1] ? args.slice(1).join(" ") : "N/A");
    const member = await moderation.getMemberFromMessage(message, args)
        .catch((e) => {
            return message.channel.send(e)
                .then((msg) => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
        });

    await Setting.findById("mutedRole", (err, doc) => {
        if (err) return message.channel.send("Something went wrong, please try again.")
            .then((msg) => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });

        if(!doc) return message.channel.send("There's no mute role defined, please set one via the settings command")
            .then((msg) => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });

        if(!member.roles.cache.has(doc.value)) return message.channel.send("This member is not muted, unable to unmute.")
            .then((msg) => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });
    });

    moderation.unmute(member, reason, message.member)
        .then(() => {
            message.channel.send(`**${member.user.tag}** has been unmuted`);
        })
        .catch(() => {
            return message.channel.send("Something went wrong, please try again.")
                .then((msg) => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
        });
}

exports.config = {
    command: "unmute"
}