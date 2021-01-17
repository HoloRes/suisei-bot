// Imports
// Local files
const moderation = require("$/util/moderation"),
    { confirmRequest } = require("$/util/functions"),
    Discord = require("discord.js"),
    config = require("$/config.json"),
    moment = require("moment");

exports.run = (client, message, args) => {
    //* Expected syntax: ?mute <userID/ping/tag> <duration> <strike (yes/no/y/n/true/false)> <reason>
    // TODO: Parse duration using moment-timezone
    if(!args[0] || args.length < 3) return message.channel.send(`**USAGE:** ${config.discord.prefix}mute <user> <duration> <reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    moderation.getMemberFromMessage(message, args, (member) => {
        const reason = args.slice(2).join(" ");
        const duration = args[1]; // TODO: Parse to usable time
        confirmAndMute(message, duration, member, reason);
    });
}

// Functions
function confirmAndMute(message, duration, member, reason) {
    const embed = new Discord.MessageEmbed()
        .setTitle(`Muting ${member.user.tag} for ${duration}`)
        .setDescription(`Reason: ${reason}`);
    message.channel.send(embed)
        .then((msg) => {
            confirmRequest(msg, message.author.id)
                .then((result) => {
                    if(result === true) {
                        message.channel.send("Calling function")
                        //moderation.mute(member, isStrike, duration, reason, message.author);
                    } else {
                        msg.edit("Cancelled.")
                        message.delete({timeout: 4000, reason: "Automated"});
                        msg.delete({timeout: 4000, reason: "Automated"});
                    }
                });
        });
}

exports.config = {
    command: "mute"
}