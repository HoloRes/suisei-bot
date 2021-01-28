// Packages
const {MessageEmbed} = require("discord.js");

// Models
const Setting = require("$/models/setting")

// Local files
const config = require("$/config.json");

exports.run = async (client, message, args) => {
    if (args.length < 2) return message.channel.send(`**USAGE:** ${config.discord.prefix}settings <setting> <value>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

    const value = args.slice(1).join(" ");

    let settings = "";
    await availableSettings.forEach((setting, index) => {
        settings += `${setting.name}${index !== availableSettings.length - 1 ? ", " : ""}`;
    });

    const setting = await availableSettings.find(item => item.name.toLowerCase() === args[0].toLowerCase());
    if (!setting) return message.channel.send(`Non existent setting, available settings: ${settings}`);

    switch (setting.type) {
        case "string":
            setSetting(setting.name, value)
                .then((succeeded) => {
                    if (succeeded) {
                        const embed = new MessageEmbed()
                            .setTitle(`Changed setting: ${setting.name}`)
                            .setDescription(`New value: ${value}`)
                        message.channel.send(embed);
                    } else message.channel.send("Something went wrong, please try again.")
                        .then(msg => {
                            message.delete({timeout: 4000, reason: "Automated"});
                            msg.delete({timeout: 4000, reason: "Automated"});
                        });
                });
            break;
        case "user":
            const user = await getUser(message, args[1]);
            if (!user) return message.channel.send("Member not found.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
            setSetting(setting.name, user.id);
            break;
        case "role":
            const role = await getRole(message, args[1]);
            if (!role) return message.channel.send("Role not found.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
            setSetting(setting.name, role.id);
            break;
        case "channel":
            const channel = await getChannel(message, args[1]);
            if (!channel) return message.channel.send("Member not found.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
            setSetting(setting.name, channel.id);
            break;
        default:
            break;
    }
}

module.exports.config = {
    command: "settings"
}

const availableSettings = [ // Available types: user, role, channel, string
    {name: "mutedRole", type: "role"},
    {name: "modLogChannel", type: "channel"}
];

function setSetting(setting, value) {
    Setting.findById(setting, (err, doc) => {
        if (err) return message.channel.send("Something went wrong, please try again.")
            .then(msg => {
                message.delete({timeout: 4000, reason: "Automated"});
                msg.delete({timeout: 4000, reason: "Automated"});
            });

        if (!doc) {
            const settingDoc = new Setting({
                _id: setting,
                value: value
            });
            settingDoc.save((err2) => {
                if (err2) return message.channel.send("Something went wrong, please try again.")
                    .then(msg => {
                        message.delete({timeout: 4000, reason: "Automated"});
                        msg.delete({timeout: 4000, reason: "Automated"});
                    });
            });
        }

        doc.value = value;
        doc.save((err2) => {
            if (err2) return message.channel.send("Something went wrong, please try again.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
        });
    })
}

function getUser(message, arg) {
    return new Promise((resolve) => {
        if (message.mentions.members.size === 1) {
            resolve(message.mentions.members.array()[0]);
        } else {
            message.guild.members.fetch(arg)
                .then((member) => {
                    return resolve(member);
                })
                .catch(() => {
                    message.guild.members.fetch()
                        .then(() => {
                            const member = message.guild.members.cache.find(guildMember => guildMember.user.tag.toLowerCase() === arg.toLowerCase());
                            return resolve(member);
                        });
                });
        }
    });
}

function getRole(arg) {
    return new Promise((resolve) => {
        if (message.mentions.roles.size === 1) {
            resolve(message.mentions.roles.array()[0]);
        } else {
            message.guild.roles.fetch(arg)
                .then((role) => {
                    return resolve(role);
                })
                .catch(() => {
                    message.guild.roles.fetch()
                        .then(() => {
                            const role = message.guild.roles.cache.find(role => role.name.toLowerCase() === arg.toLowerCase());
                            return resolve(role);
                        });
                });
        }
    });
}

function getChannel(arg) {
    return new Promise((resolve) => {
        if (message.mentions.channels.size === 1) {
            resolve(message.mentions.channels.array()[0]);
        } else {
            message.guild.channels.fetch(arg)
                .then((channel) => {
                    return resolve(channel);
                })
                .catch(() => {
                    message.guild.channels.fetch()
                        .then(() => {
                            const channel = message.guild.channels.cache.find(channel => channel.name.toLowerCase() === arg.toLowerCase());
                            return resolve(channel);
                        });
                });
        }
    });
}