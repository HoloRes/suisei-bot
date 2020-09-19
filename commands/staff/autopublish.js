// Imports
// Models
const autoPublish = require("$/models/publish");

// Local imports
const config = require("$/config.json");

exports.run = async (client, message, args) => {
    if(!args[0]) return message.channel.send(`**USAGE:** ${config.discord.staffprefix}autopublish <Discord channel id>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

    client.channels.fetch(args[0])
        .then((channel) => {
            autoPublish.findById(channel.id, (err, doc) => {
                if(err) return message.channel.send("Something went wrong, try again later").then((msg) => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
                if(doc) {
                    doc.autoPublish = !doc.autoPublish;
                    doc.save();
                    return message.channel.send(`Auto publishing for <#${channel.id}> is now **${(doc.autoPublish ? "enabled" : "disabled")}**`).then((msg) => {
                        message.delete({timeout: 4000, reason: "Automated"});
                        msg.delete({timeout: 4000, reason: "Automated"});
                    });
                } else {
                    const doc = new autoPublish({
                        _id: channel.id,
                        autoPublish: true
                    });
                    doc.save();
                    return message.channel.send(`Auto publishing for <#${channel.id}> is now **enabled**`).then((msg) => {
                        message.delete({timeout: 4000, reason: "Automated"});
                        msg.delete({timeout: 4000, reason: "Automated"});
                    });
                }
            })
        })
        .catch((err) => {
            if (err) return message.channel.send("That channel doesn't exist.").then((msg) => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });
        });
}

exports.config = {
    command: "autopublish"
}