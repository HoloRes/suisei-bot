// Models
const Music = require("$/models/music");

// Local files
const config = require("$/config.json"),
    { confirmRequest } = require("$/util/functions");

// Modules
const Discord = require("discord.js"),
    fs = require("fs"),
    S3 = require("aws-sdk/clients/s3");

// S3 init
const s3 = new S3({
    endpoint: config.s3.endpoint,
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey
});

exports.run = (client, message, args) => {
    if (!args[0]) return message.reply("please add the ID as an argument.")

    Music.findById(args[0], (err, doc) => {
        if (!doc) return message.reply("this ID is not in the database.").then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

        if (message.author.id !== doc.author && !message.member.roles.cache.has(config.discord.roles.staff)) return message.reply("you're not the owner of this file.").then(msg => {
            message.delete({timeout: 4000, reason: "Automated"});
            msg.delete({timeout: 4000, reason: "Automated"});
        });

        const embed = new Discord.MessageEmbed()
            .setTitle("Are you sure?")
            .setDescription(`Are you sure you want to delete ${doc.title} from ${doc.authorName} with ID: ${doc._id}?`)
        message.channel.send(embed).then(msg => {
            confirmRequest(msg, message.author.id)
                .then((confirmation) => {
                    msg.reactions.removeAll();
                    if(confirmation) {
                        let removalEmbed = new Discord.MessageEmbed()
                            .setTitle(`Removing file - ID: ${doc._id}`)
                            .setDescription(`
                                <a:loading:726782135792566388> - Deleting file from filesystem
                                <:pending:726786878711398430> - Remove ID from the database
                            `)
                            .setColor("#F6944C")
                            .setFooter(message.author.tag, message.author.avatarURL());
                        msg.edit(removalEmbed);

                        const params = {
                            Bucket: config.s3.bucket,
                            Key: `${doc._id}.mp3`
                        };

                        s3.deleteObject(params, (err, data) => {
                            if (err) {
                                removalEmbed
                                    .setDescription(`
                                            <:failure:726785875215777823> - Deleting file from filesystem
                                            <:pending:726786878711398430> - Remove ID from the database
                                        `)
                                    .setColor("#FF0000");
                                msg.edit(removalEmbed);
                                msg.delete({ timeout: 4000, reason: "Automated" });
                                return message.delete({ timeout: 4000, reason: "Automated" });
                            }
                            else {
                                removalEmbed
                                    .setDescription(`
                                        <:check:726782736617963561> - Deleting file from filesystem
                                        <a:loading:726782135792566388> - Remove ID from the database
                                    `);
                                msg.edit(removalEmbed);
                                doc.remove(err => {
                                    if(err) {
                                        removalEmbed
                                            .setDescription(`
                                                <:check:726782736617963561> - Deleting file from filesystem
                                                <:failure:726785875215777823> - Remove ID from the database
                                            `)
                                            .setColor("#FF0000");
                                        msg.edit(removalEmbed);
                                        msg.delete({timeout: 4000, reason: "Automated"});
                                        return message.delete({timeout: 4000, reason: "Automated"});
                                    }
                                    else {
                                        removalEmbed
                                            .setDescription(`
                                                <:check:726782736617963561> - Deleting file from filesystem
                                                <:check:726782736617963561> - Remove ID from the database
                                            `)
                                            .setColor("#7AC853");
                                        msg.edit(removalEmbed);
                                        msg.delete({timeout: 4000, reason: "Automated"});
                                        return message.delete({timeout: 4000, reason: "Automated"});
                                    }
                                });
                            }
                        });
                    } else {
                        msg.edit("Cancelled");
                        msg.delete({ timeout: 4000, reason: "Automated" });
                        return message.delete({ timeout: 4000, reason: "Automated" });
                    }
                });
        });
    });
}
module.exports.config = {
    command: "remove"
}
