// Imports
// Local files
const moderation = require("$/util/moderation"),
    { confirmRequest } = require("$/util/functions"),
    Discord = require("discord.js"),
    config = require("$/config.json");

exports.run = (client, message, args) => {
    //* Expected syntax: [warn <userID/ping/tag> <strike (yes/no/y/n/true/false)> <reason>
    if(!args[0]) return message.channel.send(`**USAGE:** ${config.discord.staffprefix}warn <user> <strike> <reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    moderation.getMemberFromMessage(message, args, (member) => {
        const reason = args.slice(2).join(" ");
        let isStrikeArg = args[1].toLowerCase();
        if(isStrikeArg === "n" || isStrikeArg === "no" || isStrikeArg === "false") confirmAndWarn(message, member, reason ,false);
        else if(isStrikeArg === "y" || isStrikeArg === "yes" || isStrikeArg === "true") confirmAndWarn(message, member, reason, true);
        else return message.channel.send(`**USAGE:** ${config.discord.staffprefix}warn <user> <strike> <reason>`)
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
    });
}

// Functions
function confirmAndWarn(message, member, reason, isStrike) {
    const embed = new Discord.MessageEmbed()
        .setTitle(`Warning ${member.user.tag}`)
        .setDescription(`Reason: ${reason}\nStrike: ${(isStrike ? "yes" : "no")}`);
    message.channel.send(embed)
        .then((msg) => {
            confirmRequest(msg, message.author.id)
                .then((result) => {
                    if(result === true) {
                        moderation.warn(member, isStrike, reason, message.author);
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