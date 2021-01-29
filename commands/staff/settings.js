// Imports
// Packages
const {MessageEmbed} = require("discord.js");

// Local files
const config = require("$/config.json");

// Models
const Setting = require("$/models/setting");

exports.run = async (client, message, args) => {
    if (!args[0]) return message.channel.send(`**USAGE:** ${config.discord.prefix}settings <setting> <value>`)
        .then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

    let settings = "";
    await availableSettings.forEach((setting, index) => {
        settings += `${setting.name}${index !== availableSettings.length - 1 ? ", " : ""}`;
    });

    const setting = await availableSettings.find(item => item.name.toLowerCase() === args[0].toLowerCase());
    if (!setting) return message.channel.send(`Non existent setting, available settings: ${settings}`);

    if (!args[1]) {
        return Setting.findById(setting.name, (err, doc) => {
            if (err) return message.channel.send("Something went wrong, please try again.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });

            if (!doc) {
                const embed = new MessageEmbed()
                    .setTitle(`Current value for: ${setting.name}`)
                    .setDescription("None")
                message.channel.send(embed);
            } else {
                switch (setting.type) {
                    case "string":
                        send(doc.value);
                        break;
                    case "user":
                        send(`<@${doc.value}>`);
                        send();
                        break;
                    case "role":
                        send(`<@&${doc.value}>`);
                        break;
                    case "channel":
                        send(`<#${doc.value}>`);
                        break;
                    default:
                        break;
                }

                function send(value) {
                    const embed = new MessageEmbed()
                        .setTitle(`Current value for: ${setting.name}`)
                        .setDescription(value);
                    message.channel.send("", {embed: embed, disableMentions: true});
                }
            }
        });
    }
    const value = args.slice(1).join(" ");

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
            const user = await getUser(message, value);
            if (!user) return message.channel.send("Member not found.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
            setSetting(setting.name, user.id)
                .then((succeeded) => {
                    if (succeeded) {
                        const embed = new MessageEmbed()
                            .setTitle(`Changed setting: ${setting.name}`)
                            .setDescription(`New value: <@${user.id}>`)
                        message.channel.send(embed);
                    } else message.channel.send("Something went wrong, please try again.")
                        .then(msg => {
                            message.delete({timeout: 4000, reason: "Automated"});
                            msg.delete({timeout: 4000, reason: "Automated"});
                        });
                });
            break;
        case "role":
            const role = await getRole(message, value);
            if (!role) return message.channel.send("Role not found.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
            setSetting(setting.name, role.id)
                .then((succeeded) => {
                    if (succeeded) {
                        const embed = new MessageEmbed()
                            .setTitle(`Changed setting: ${setting.name}`)
                            .setDescription(`New value: <@&${role.id}>`)
                        message.channel.send(embed);
                    } else message.channel.send("Something went wrong, please try again.")
                        .then(msg => {
                            message.delete({timeout: 4000, reason: "Automated"});
                            msg.delete({timeout: 4000, reason: "Automated"});
                        });
                });
            break;
        case "channel":
            const channel = await getChannel(message, value);
            if (!channel) return message.channel.send("Member not found.")
                .then(msg => {
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });
            setSetting(setting.name, channel.id)
                .then((succeeded) => {
                    if (succeeded) {
                        const embed = new MessageEmbed()
                            .setTitle(`Changed setting: ${setting.name}`)
                            .setDescription(`New value: <#${channel.id}>`)
                        message.channel.send(embed);
                    } else message.channel.send("Something went wrong, please try again.")
                        .then(msg => {
                            message.delete({timeout: 4000, reason: "Automated"});
                            msg.delete({timeout: 4000, reason: "Automated"});
                        });
                });
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
    return new Promise((resolve) => {
        Setting.findById(setting, (err, doc) => {
            if (err) return message.channel.send("Something went wrong, please try again.")
                .then(msg => {
                    resolve(false);
                    message.delete({timeout: 4000, reason: "Automated"});
                    msg.delete({timeout: 4000, reason: "Automated"});
                });

            if (!doc) {
                const settingDoc = new Setting({
                    _id: setting,
                    value: value
                });
                settingDoc.save((err2) => {
                    if (err2) {
                        resolve(false);
                        return message.channel.send("Something went wrong, please try again.")
                            .then(msg => {
                                message.delete({timeout: 4000, reason: "Automated"});
                                msg.delete({timeout: 4000, reason: "Automated"});
                            });
                    } else resolve(true);
                });
            } else {
                doc.value = value;
                doc.save((err2) => {
                    if (err2) {
                        resolve(false);
                        return message.channel.send("Something went wrong, please try again.")
                            .then(msg => {
                                message.delete({timeout: 4000, reason: "Automated"});
                                msg.delete({timeout: 4000, reason: "Automated"});
                            });
                    } else resolve(true);
                });
            }
        })
    });
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

function getRole(message, arg) {
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

function getChannel(message, arg) {
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