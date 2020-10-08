// Imports
// Local files
const moderation = require("$/util/moderation"),
    config = require("$/config.json");

exports.run = (client, message, args) => {
    //* Expected syntax: [warn <userID/ping/tag> <strike (yes/no/y/n/true/false)> <reason>
    if(!args[0]) return message.channel.send(`**USAGE:** ${config.discord.staffprefix}warn <user> <strike> <reason>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    if(message.mentions.members.size === 1) { // TODO: Move to moderation.js as this will be used in every moderation command
        message.channel.send(`Mention: ${message.mentions.members.array()[0].user.tag}`);
    } else {
        message.guild.members.fetch(args[0])
            .then((member) => {
                message.channel.send(`Fetch ID: ${member.user.tag}`);
            })
            .catch((e) => {
                if(e) message.guild.members.fetch()
                    .then(() => {
                        const member = message.guild.members.cache.find(guildMember =>  guildMember.user.tag.toLowerCase() === args[0].toLowerCase());
                        if(!member) return message.channel.send("Cannot find this user.")
                            .then(msg => {
                                message.delete({timeout: 4000, reason: "Automated"});
                                msg.delete({timeout: 4000, reason: "Automated"});
                            });
                        message.channel.send(`Query: ${member.user.tag}`);
                    });
            })
    }
}

exports.config = {
    command: "warn"
}