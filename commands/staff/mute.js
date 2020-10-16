// Imports
// Local files
const moderation = require("$/util/moderation"),
    { confirmRequest } = require("$/util/functions"),
    Discord = require("discord.js"),
    config = require("$/config.json");

exports.run = (client, message, args) => {
    //* Expected syntax: ?mute <userID/ping/tag> <duration> <strike (yes/no/y/n/true/false)> <reason>
    if(!args[0]) return message.channel.send(`**USAGE:** ${config.discord.prefix}mute <user> <duration> <strike> <reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    moderation.getMemberFromMessage(message, args, (member) => {
        const reason = args.slice(3).join(" ");
        let isStrikeArg = args[2].toLowerCase();
        const duration = args[1]; // TODO: Parse to usable time
        if(isStrikeArg === "n" || isStrikeArg === "no" || isStrikeArg === "false") confirmAndMute(message, duration, member, reason ,false);
        else if(isStrikeArg === "y" || isStrikeArg === "yes" || isStrikeArg === "true") confirmAndMute(message, duration, member, reason, true);
        else return message.channel.send(`**USAGE:** ${config.discord.prefix}mute <user> <duration> <strike> <reason>`)
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
    });
}

// Functions
function confirmAndMute(message, duration, member, reason, isStrike) {
    const embed = new Discord.MessageEmbed()
        .setTitle(`Muting ${member.user.tag} for `)
        .setDescription(`Reason: ${reason}\nStrike: ${(isStrike ? "yes" : "no")}`);
    message.channel.send(embed)
        .then((msg) => {
            confirmRequest(msg, message.author.id)
                .then((result) => {
                    if(result === true) {
                        moderation.mute(member, isStrike, duration, reason, message.author);
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