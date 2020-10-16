// Imports
// Local files
const moderation = require("$/util/moderation"),
    { confirmRequest } = require("$/util/functions"),
    Discord = require("discord.js"),
    config = require("$/config.json");

exports.run = (client, message, args) => {
    //* Expected syntax: [warn <userID/ping/tag> <reason>
    if(!args[0]) return message.channel.send(`**USAGE:** ${config.discord.prefix}warn <user><reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    moderation.getMemberFromMessage(message, args, (member) => {
        const reason = args.slice(1).join(" ");
        confirmAndWarn(message, member, reason);
    });
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
                        moderation.warn(member, reason, message.author);
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