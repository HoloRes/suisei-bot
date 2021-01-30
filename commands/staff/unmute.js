// Imports
// Packages
const config = require("$/config.json");

// Local files
const moderation = require("$/util/moderation");

exports.run = async (client, message, args) => {
    if(args.length < 1) return message.channel.send(`**USAGE:** ${config.discord.prefix}unmute <user> <reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

    const reason = (args[1] ? args.slice(1).join(" ") : "N/A");
    const member = await moderation.getMemberFromMessage(message, args)
        .catch(() => {
            return message.channel.send("Member not found")
                .then((msg) => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
        });

    moderation.unmute(member, reason, message.member)
        .then(() => {
            message.channel.send(`**${member.user.tag}** has been unmuted`)
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