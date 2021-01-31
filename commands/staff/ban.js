// Imports
// Packages
const {MessageEmbed} = require("discord.js");

// Local files
const moderation = require("$/util/moderation"),
    {confirmRequest} = require("$/util/functions"),
    config = require("$/config.json");

exports.run = async (client, message, args) => {
    if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}ban <user> <reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

    const member = await moderation.getMemberFromMessage(message, args)
        .catch((e) => {
            return message.channel.send(e)
                .then((msg) => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
        });
    const reason = await args.slice(1).join(" ");

    confirmAndBan(message, member, reason);
}

// Functions
function confirmAndBan(message, member, reason) {
    const embed = new MessageEmbed()
        .setTitle(`Banning **${member.user.tag}**`)
        .setDescription(`Reason: ${reason}`);

    message.channel.send(embed)
        .then((msg) => {
            confirmRequest(msg, message.author.id)
                .then((result) => {
                    if (result === true) {
                        moderation.ban(member, reason, message.member)
                            .then((status) => {
                                if (status.info) message.channel.send(`Ban succeeded, but ${status.info}`);
                                else message.channel.send(`**${member.user.tag}** has been banned`);
                            })
                            .catch(() => {
                                return message.channel.send("Something went wrong, please try again.");
                            });
                    } else {
                        msg.edit("Cancelled.")
                        message.delete({timeout: 4000, reason: "Automated"});
                        msg.delete({timeout: 4000, reason: "Automated"});
                    }
                });
        });
}

exports.config = {
    command: "ban"
}