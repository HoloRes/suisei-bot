// Imports
// Local files
const moderation = require("$/util/moderation"),
    { confirmRequest } = require("$/util/functions"),
    Discord = require("discord.js"),
    config = require("$/config.json");

exports.run = async (client, message, args) => {
    if(!args[0]) return message.channel.send(`**USAGE:** ${config.discord.prefix}warn <user><reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

    const reason = await args.slice(1).join(" ");
    const member = await moderation.getMemberFromMessage(message, args)
        .catch(() => {
            return message.channel.send("Member not found")
                .then((msg) => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
        });

    confirmAndWarn(message, member, reason);
}

// Functions
function confirmAndWarn(message, member, reason) {
    const embed = new Discord.MessageEmbed()
        .setTitle(`Warning ${member.user.tag}`)
        .setDescription(`Reason: ${reason}`);
    message.channel.send(embed)
        .then((msg) => {
            confirmRequest(msg, message.author.id)
                .then((result) => {
                    if(result === true) {
                        moderation.warn(member, reason, message.member)
                            .then((status) => {
                                if(status.info) message.channel.send(`Warn succeeded, but ${status.info}`);
                                else message.channel.send(`**${member.user.tag}** has been warned`)
                            })
                            .catch(() => {
                                return message.channel.send("Something went wrong, please try again.")
                                    .then((msg) => {
                                        message.delete({timeout: 4000, reason: "Automated"});
                                        msg.delete({timeout: 4000, reason: "Automated"});
                                    });
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
    command: "warn"
}