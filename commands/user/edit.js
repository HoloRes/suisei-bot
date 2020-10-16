// Models
const Music = require("$/models/music");

// Modules
const Discord = require("discord.js");

// Local files
const {confirmRequest} = require("$/util/functions"),
    config = require("$/config.json");

exports.run = (client, message, args) => {
    let id = args[0];
    if(!id) {
        return message.channel.send("Please pass the ID as argument.").then(sentMsg => {
            sentMsg.delete({timeout: 4000, reason: "Automated"});
        });
    }
    let embed, msg;
    message.delete({reason: "Automated"});

    Music.findById(id, (err, doc) => {
        if (err) {
            return message.channel.send("Something went wrong, try again later.").then(sentMsg => {
                sentMsg.delete({timeout: 4000, reason: "Automated"});
            });
        }
        if (message.author.id !== doc.author) {
            if(!message.member.roles.cache.has(config.discord.roles.staff)) {
                return message.channel.send("You don't own this file.")
                    .then(sentMsg => {
                        sentMsg.delete({timeout: 4000, reason: "Automated"});
                    });
            }
            embed = new Discord.MessageEmbed()
                .setTitle(`Edit ${id}`)
                .setDescription("You don't own this file, do you want to edit it anyway?")
                .setFooter(message.author.tag, message.author.avatarURL());
            async function setMsg() {
                await message.channel.send(embed).then(sentMsg => {
                    msg = sentMsg;
                });
                confirmRequest(msg, message.author.id)
                    .then(result => {
                        if (result === true) {
                            msg.reactions.removeAll();
                            editProcess(message, doc);
                        } else {
                            msg.delete({timeout: 4000, reason: "Automated"});
                        }
                    });
            }
            setMsg();
        } else {
            embed = new Discord.MessageEmbed()
                .setTitle(`Edit ${id}`)
                .setFooter(message.author.tag, message.author.avatarURL());
            async function setMsg() {
                await message.channel.send(embed).then(sentMsg => {
                    msg = sentMsg;
                });
                editProcess(message, doc);
            };
            setMsg();
        }
    });

    function editProcess(message, doc) {
        embed.setDescription(`
            What do you want to edit?
            1️⃣ File owner
            2️⃣ Author name
            3️⃣ File name
        `)
        msg.edit(embed);
        msg.react("1️⃣").then(msg.react("2️⃣").then(msg.react("3️⃣")));
        const filter = (reaction, user) => {
            return ["1️⃣", "2️⃣", "3️⃣"].includes(reaction.emoji.name) && user.id === message.author.id;
        };
        const collector = msg.createReactionCollector(filter, {time: 15000});

        collector.on("collect", r => {
            collector.stop();
            msg.reactions.removeAll();
            switch (r.emoji.name) {
                case "1️⃣":
                    editOwner(message, doc);
                    break;
                case "2️⃣":
                    editAuthorName(message, doc);
                    break;
                case "3️⃣":
                    editTitle(message, doc);
                    break;
            }
        });

        collector.on("end", collected => {
            if (collected.size === 0) {
                msg.edit("Edit cancelled.");
                msg.delete({timeout: 4000, reason: "Automated"});
            }
        });
    }

    function editOwner(message, doc) {
        const filter = (collectedMsg) => {
            return collectedMsg.author.id === message.author.id;
        }
        const collector = message.channel.createMessageCollector(filter, {time: 30000});
        embed.setDescription("Mention or give the ID of the user you want to transfer ownership to.\nType \"cancel\" to cancel this action.");
        msg.edit(embed);
        collector.on("collect", (collectedMsg) => {
            collector.stop();
            collectedMsg.delete({reason: "Automated"});
            if (collectedMsg.mentions.users.size > 0) {
                const selectedUser = collectedMsg.mentions.users.first();
                setOwner(message, doc, selectedUser, collectedMsg);
            } else {
                if (collectedMsg.content.toLowerCase() === "cancel") {
                    embed.setDescription("Ownership transfer cancelled.");
                    msg.edit(embed);
                    msg.delete({timeout: 4000, reason: "Automated"});
                } else {
                    message.guild.members.fetch(collectedMsg.content)
                        .then(selectedUser => {
                            if (!selectedUser) {
                                embed.setDescription("This member could not be found, cancelling transfer.");
                                msg.edit(embed);
                                msg.delete({timeout: 4000, reason: "Automated"});
                            } else {
                                setOwner(message, doc, selectedUser.user, collectedMsg);
                            }
                        });
                }
            }
        });

        collector.on("end", collected => {
            if (collected.size === 0) {
                embed.setDescription("Ownership transfer cancelled.");
                msg.edit(embed);
                msg.delete({timeout: 4000, reason: "Automated"});
            }
        });
    }

    function setOwner(message, doc, selectedUser) {
        doc.author = selectedUser.id;
        embed.setDescription(`Are you sure you want to transfer ownership to: \`${selectedUser.tag}\`?`);
        msg.edit(embed);
        confirmRequest(msg, message.author.id)
            .then(result => {
                if (result === true) {
                    doc.save();
                    embed.setDescription(`Ownership has been transferred to \`${selectedUser.tag}\`.`);
                } else {
                    embed.setDescription("Ownership transfer cancelled.");
                }
                msg.edit(embed);
                msg.delete({timeout: 4000, reason: "Automated"});
            });
    }

    function editAuthorName(message, doc) {
        const filter = (collectedMsg) => {
            return collectedMsg.author.id === message.author.id;
        }
        const collector = message.channel.createMessageCollector(filter, {time: 30000});
        embed.setDescription("Send the new author name.\nType \"cancel\" to cancel this action.");
        msg.edit(embed);
        collector.on("collect", collectedMsg => {
            collector.stop();
            collectedMsg.delete({reason: "Automated"});
            if (collectedMsg.content.toLowerCase() === "cancel") {
                embed.setDescription("Author name change cancelled.");
                msg.edit(embed);
                msg.delete({timeout: 4000, reason: "Automated"});
            } else {
                doc.authorName = collectedMsg.content;
                embed.setDescription(`Are you sure you want to change the author name to: \'${collectedMsg.content}\'?`);
                msg.edit(embed);
                confirmRequest(msg, message.author.id)
                    .then(result => {
                        if (result === true) {
                            doc.save();
                            embed.setDescription(`Author name has been changed to: \'${collectedMsg.content}\'.`);
                        } else {
                            embed.setDescription(`Author name change cancelled.`);
                        }
                        msg.edit(embed);
                        msg.delete({timeout: 4000, reason: "Automated"});
                    });
            }
        });
    }

    function editTitle(message, doc) {
        const filter = (collectedMsg) => {
            return collectedMsg.author.id === message.author.id;
        }
        const collector = message.channel.createMessageCollector(filter, {time: 30000});
        embed.setDescription("Send the new title.\nType \"cancel\" to cancel this action.");
        msg.edit(embed);
        collector.on("collect", collectedMsg => {
            collector.stop();
            collectedMsg.delete({reason: "Automated"});
            if (collectedMsg.content.toLowerCase() === "cancel") {
                embed.setDescription("Title change cancelled.");
                msg.edit(embed);
                msg.delete({timeout: 4000, reason: "Automated"});
            } else {
                doc.title = collectedMsg.content;
                embed.setDescription(`Are you sure you want to change the title to: \'${collectedMsg.content}\'?`);
                msg.edit(embed);
                confirmRequest(msg, message.author.id)
                    .then(result => {
                        if (result === true) {
                            doc.save();
                            embed.setDescription(`Title has been changed to: \'${collectedMsg.content}\'.`);
                        } else {
                            embed.setDescription(`Title change cancelled.`);
                        }
                        msg.edit(embed);
                        msg.delete({timeout: 4000, reason: "Automated"});
                    });
            }
        });
    }
}

module.exports.config = {
    command: "edit",
    limited: "musician"
}
