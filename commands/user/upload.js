// Schemas
const Music = require("$/models/music");

// Modules
const https = require("https"), // This will be used to download files
    fs = require("fs"),
    ffmpeg = require("fluent-ffmpeg"),
    NodeID3 = require('node-id3'),
    util = require("util"),
    Discord = require("discord.js");

exports.run = (client, message, args) => {
    // Upload process
    if (message.attachments.size === 0) { // Check if there are any attachments
        message.delete({timeout: 4000, reason: "Automated"});
        return message.channel.send("Please attach a MP3 or FLAC file to upload.").then(msg => {
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    }
    const file = message.attachments.first();

    if (!/\.mp3$/i.test(file.url)) { // Check if the file is a MP3
        message.delete({timeout: 4000, reason: "Automated"});
        return message.channel.send("Invalid file type: Please attach a MP3 or FLAC file to upload.").then(msg => {
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    }

    // Create a progress report
    let embed = new Discord.MessageEmbed()
        .setTitle("Uploading file - ID: pending")
        .setDescription(`
            <a:loading:726782135792566388> - Downloading file
            <:pending:726786878711398430> - Checking file
            <:pending:726786878711398430> - Converting file
            <:pending:726786878711398430> - Add to the Database
        `)
        .setColor("#F6944C")
        .setFooter(message.author.tag, message.author.avatarURL());
    let msg;
    if (message.author.dmChannel) message.author.createDM();
    message.author.send(embed).then(sentMsg => {
        msg = sentMsg
    });

    const doc = new Music({author: parseInt(message.author.id)}); // Create a new MongoDB document
    const tmpFile = fs.createWriteStream(`./tmp/download/${doc._id}.mp3`);
    https.get(file.url, (res) => { // Download the file
        res.pipe(tmpFile);
        res.on('end', () => {
            embed
                .setDescription(`
                    <:check:726782736617963561> - Downloading file
                    <a:loading:726782135792566388> - Checking file
                    <:pending:726786878711398430> - Converting file
                    <:pending:726786878711398430> - Add to the Database
                `)
                .setTitle(`Uploading file - ID: ${doc._id}`)
            msg.edit(embed)
            message.delete();
            NodeID3.read(`./tmp/download/${doc._id}.mp3`, function (err, tags) {
                if (!tags.title) {
                    embed = new Discord.MessageEmbed()
                        .setTitle("Uploading file - Failed")
                        .setDescription(`
                            <:check:726782736617963561> - Downloading file
                            <:failure:726785875215777823> - Checking file
                            <:pending:726786878711398430> - Converting file
                            <:pending:726786878711398430> - Add to the Database
                        `)
                        .setColor("#FF0000")
                        .setFooter(message.author.tag, message.author.avatarURL());
                    msg.edit(embed);
                    fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                    return message.author.send("Your file doesn't have the song name field populated, please fix this with for example Mp3Tag.");
                }
                doc.title = tags.title;
                if (!tags.artist) {
                    const requestEmbed = new Discord.MessageEmbed()
                        .setTitle("Problem found")
                        .setDescription("It seems like the artist field isn't populated, do you want to populate this with your username or cancel the upload?")
                    msg.edit(requestEmbed);
                    msg.react("726782736617963561").then(() => { // Confirm reaction
                        msg.react("726785875215777823"); // Cancel reaction
                    });

                    const filter = (reaction, user) => {
                        return ['726782736617963561', '726785875215777823'].includes(reaction.emoji.id) && user.id === message.author.id;
                    };
                    const collector = msg.createReactionCollector(filter, {time: 15000});

                    collector.on('collect', r => {
                        if (r.emoji.id === "726782736617963561") {
                            msg.edit(embed);
                            let newTags = {
                                artist: message.author.username
                            };
                            doc.authorName = message.author.username;

                            if (NodeID3.update(tags, `./tmp/download/${doc._id}.mp3`) === false) {
                                embed = new Discord.MessageEmbed()
                                    .setTitle("Uploading file - Failed")
                                    .setDescription(`
                                        <:check:726782736617963561> - Downloading file
                                        <:failure:726785875215777823> - Checking file
                                        <:pending:726786878711398430> - Converting file
                                        <:pending:726786878711398430> - Add to the Database
                                    `)
                                    .setColor("#FF0000")
                                    .setFooter(message.author.tag, message.author.avatarURL());
                                msg.edit(embed);
                                fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                                return message.author.send("Updating tag failed");
                            }
                            else convertAndDb(doc, msg, embed, message, tags);
                        } else if (r.emoji.id === "726785875215777823") {
                            embed = new Discord.MessageEmbed()
                                .setTitle("Uploading file - Failed")
                                .setDescription(`
                                    <:check:726782736617963561> - Downloading file
                                    <:failure:726785875215777823> - Checking file
                                    <:pending:726786878711398430> - Converting file
                                    <:pending:726786878711398430> - Add to the Database
                                `)
                                .setColor("#FF0000")
                                .setFooter(message.author.tag, message.author.avatarURL());
                            msg.edit(embed);
                            fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                            return message.author.send("Cancelled");
                        }
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            embed = new Discord.MessageEmbed()
                                .setTitle("Uploading file - Failed")
                                .setDescription(`
                                    <:check:726782736617963561> - Downloading file
                                    <:failure:726785875215777823> - Checking file
                                    <:pending:726786878711398430> - Converting file
                                    <:pending:726786878711398430> - Add to the Database
                                `)
                                .setColor("#FF0000")
                                .setFooter(message.author.tag, message.author.avatarURL());
                            msg.edit(embed);
                            fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                            return message.author.send("Cancelled");
                        }
                    });
                }
                else {
                    doc.authorName = tags.artist;
                    convertAndDb(doc, msg, embed, message, tags);
                }
            });
        })
    }).on('error', (e) => {
        console.error(e);
        embed = new Discord.MessageEmbed()
            .setTitle("Uploading file - Failed")
            .setDescription(`
                <:failure:726785875215777823> - Downloading file
                <:pending:726786878711398430> - Checking file
                <:pending:726786878711398430> - Converting file
                <:pending:726786878711398430> - Add to the Database
            `)
            .setColor("#FF0000")
            .setFooter(message.author.tag, message.author.avatarURL());
        return msg.edit(embed);
    });

}

exports.config = {
    command: "upload"
}

// Functions
function ext(url) { // (Stolen) from https://stackoverflow.com/a/6997591
    return (url = url.substr(1 + url.lastIndexOf("/")).split('?')[0]).split('#')[0].substr(url.lastIndexOf("."))
}

function convertAndDb(doc, msg, embed, message, tags) {
    ffmpeg.ffprobe(`./tmp/download/${doc._id}.mp3`, (err, metadata) => {
        if (Math.round(metadata.streams[0].bit_rate / 1000) > 128) {
            embed
                .setDescription(`
                    <:check:726782736617963561> - Downloading file
                    <:check:726782736617963561> - Checking file
                    <a:loading:726782135792566388> - Converting file
                    <:pending:726786878711398430> - Add to the Database
                `);
            msg.edit(embed);

            ffmpeg(`./tmp/download/${doc._id}.mp3`)
                .audioCodec('libmp3lame')
                .noVideo()
                .save(`./tmp/conversion/${doc._id}.mp3`)
                .audioBitrate('128k')
                .on('error', err => {
                    if(err) {
                        console.error(err)
                        embed = new Discord.MessageEmbed()
                            .setTitle("Uploading file - Failed")
                            .setDescription(`
                                <:check:726782736617963561> - Downloading file
                                <:check:726782736617963561> - Checking file
                                <:failure:726785875215777823> - Converting file
                                <:pending:726786878711398430> - Add to the Database
                            `)
                            .setColor("#FF0000")
                            .setFooter(message.author.tag, message.author.avatarURL());
                        msg.edit(embed);
                        fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                        if (fs.existsSync(`./tmp/conversion/${doc._id}.mp3`)) fs.unlinkSync(`./tmp/conversion/${doc._id}.mp3`);
                        return message.author.send("Conversion failed");
                    }
                })
                .on('end', () => {
                    embed
                        .setDescription(`
                            <:check:726782736617963561> - Downloading file
                            <:check:726782736617963561> - Checking file
                            <:check:726782736617963561> - Converting file
                            <a:loading:726782135792566388> - Add to the Database
                        `);
                    msg.edit(embed);
                    fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                    fs.copyFileSync(`./tmp/conversion/${doc._id}.mp3`, `./public/audio/${doc._id}.mp3`)
                    fs.unlinkSync(`./tmp/conversion/${doc._id}.mp3`);
                    doc.save();
                    embed
                        .setDescription(`
                            <:check:726782736617963561> - Downloading file
                            <:check:726782736617963561> - Checking file
                            <:check:726782736617963561> - Converting file
                            <:check:726782736617963561> - Add to the Database
                        `)
                        .setColor("#7AC853");
                    msg.edit(embed);
                });
        } else {
            embed
                .setDescription(`
                    <:check:726782736617963561> - Downloading file
                    <:check:726782736617963561> - Checking file
                    <:skip:726787489930412042> - Converting file
                    <a:loading:726782135792566388> - Add to the Database
                `);
            msg.edit(embed);
            fs.copyFileSync(`./tmp/download/${doc._id}.mp3`, `$/public/audio/${doc._id}.mp3`);
            fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
            doc.save();
            embed
                .setDescription(`
                    <:check:726782736617963561> - Downloading file
                    <:check:726782736617963561> - Checking file
                    <:skip:726787489930412042> - Converting file
                    <:check:726782736617963561> - Add to the Database
                `)
                .setColor("#7AC853");
            msg.edit(embed);
        }
    });
}