// Schemas
const Music = require("$/models/music");

// Modules
const https = require("https"), // This will be used to download files
    fs = require("fs"),
    ffmpeg = require("fluent-ffmpeg"),
    NodeID3 = require("node-id3"),
    Discord = require("discord.js"),
    S3 = require("aws-sdk/clients/s3");

// Local files
const config = require("$/config.json"),
    { confirmRequest } = require("$/util/functions");

// S3 init
const s3 = new S3({
    endpoint: config.s3.endpoint,
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey
});

exports.run = (client, message, args) => {
    // Upload process
    if (message.attachments.size === 0) { // Check if there are any attachments
        message.delete({timeout: 4000, reason: "Automated"});
        return message.channel.send("Please attach a MP3 file to upload.").then(msg => {
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    }
    const file = message.attachments.first();

    if (!/\.mp3$/i.test(file.url)) { // Check if the file is a MP3
        message.delete({timeout: 4000, reason: "Automated"});
        return message.channel.send("Invalid file type: Please attach a MP3 file to upload.").then(msg => {
            msg.delete({timeout: 4000, reason: "Automated"});
        });
    }

    // Create a progress report in the user's DM
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

    const doc = new Music({author: message.author.id}); // Create a new MongoDB document
    const tmpFile = fs.createWriteStream(`./tmp/download/${doc._id}.mp3`);
    https.get(file.url, (res) => { // Download the file
        res.pipe(tmpFile);
        res.on("end", () => {
            embed
                .setDescription(`
                    <:check:726782736617963561> - Downloading file
                    <a:loading:726782135792566388> - Checking file
                    <:pending:726786878711398430> - Converting file
                    <:pending:726786878711398430> - Upload the file to S3
                    <:pending:726786878711398430> - Add to the Database
                `)
                .setTitle(`Uploading file - ID: ${doc._id}`)
            msg.edit(embed)
            message.delete();
            NodeID3.read(`./tmp/download/${doc._id}.mp3`, function (err, tags) {
                if (!tags.title) {
                    let requestEmbed = new Discord.MessageEmbed()
                        .setTitle("Problem found")
                        .setDescription("It seems like the title field isn't populated, do you want to populate this or cancel the upload?")
                    msg.edit(requestEmbed);
                    confirmRequest(msg, message.author.id)
                        .then((wantSetTitle) => {
                           if(wantSetTitle) {
                               requestEmbed
                                   .setDescription("Send the title as a message");
                               msg.edit(requestEmbed);
                               const msgCollector = new Discord.MessageCollector(message.author.dmChannel, m => m.author.id === message.author.id, { time: 30000 });
                               msgCollector.on("collect", (title) => {
                                   msgCollector.stop();
                                   if(!title) {
                                       embed = new Discord.MessageEmbed()
                                           .setTitle("Uploading file - Failed")
                                           .setDescription(`
                                                <:check:726782736617963561> - Downloading file
                                                <:failure:726785875215777823> - Checking file
                                                <:pending:726786878711398430> - Converting file
                                                <:pending:726786878711398430> - Upload the file to S3
                                                <:pending:726786878711398430> - Add to the Database
                                            `)
                                           .setColor("#FF0000")
                                           .setFooter(message.author.tag, message.author.avatarURL());
                                       msg.edit(embed);
                                       fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                                       return message.author.send("Cancelled");
                                   } else {
                                       const confirmEmbed = new Discord.MessageEmbed()
                                           .setTitle("Confirm")
                                           .setDescription(`Is this title correct: \`${title}\`?`);
                                       msg.edit(confirmEmbed);
                                       confirmRequest(msg, message.author.id)
                                           .then((setTitle) => {
                                               if (setTitle) {
                                                   doc.title = title;
                                                   moreID3checks(doc, msg, embed, message, tags);
                                               }
                                           });
                                   }
                               });

                               msgCollector.on("end", (collected) => {
                                   if(collected.size === 0) {
                                       embed = new Discord.MessageEmbed()
                                           .setTitle("Uploading file - Failed")
                                           .setDescription(`
                                                <:check:726782736617963561> - Downloading file
                                                <:failure:726785875215777823> - Checking file
                                                <:pending:726786878711398430> - Converting file
                                                <:pending:726786878711398430> - Upload the file to S3
                                                <:pending:726786878711398430> - Add to the Database
                                            `)
                                           .setColor("#FF0000")
                                           .setFooter(message.author.tag, message.author.avatarURL());
                                       msg.edit(embed);
                                       fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                                       return message.author.send("Cancelled");
                                   };
                               });
                           }
                        });
                } else{
                    doc.title = tags.title;
                    moreID3checks(doc, msg, embed, message, tags);
                }
            });
        })
    }).on("error", (e) => {
        console.error(e);
        embed = new Discord.MessageEmbed()
            .setTitle("Uploading file - Failed")
            .setDescription(`
                <:failure:726785875215777823> - Downloading file
                <:pending:726786878711398430> - Checking file
                <:pending:726786878711398430> - Converting file
                <:pending:726786878711398430> - Upload the file to S3
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
    return (url = url.substr(1 + url.lastIndexOf("/")).split("?")[0]).split("#")[0].substr(url.lastIndexOf("."))
}

function moreID3checks (doc, msg, embed, message, tags) {
    if (!tags.artist) {
        const requestEmbed = new Discord.MessageEmbed()
            .setTitle("Problem found")
            .setDescription("It seems like the artist field isn't populated, do you want to populate this with your username or cancel the upload?")
        msg.edit(requestEmbed);
        confirmRequest(msg, message.author.id)
            .then((confirmation) => {
                if(confirmation) {
                    msg.edit(embed);
                    doc.authorName = message.author.username;

                    if (NodeID3.update({artist: message.author.username}, `./tmp/download/${doc._id}.mp3`) === false) {
                        embed = new Discord.MessageEmbed()
                            .setTitle("Uploading file - Failed")
                            .setDescription(`
                                            <:check:726782736617963561> - Downloading file
                                            <:failure:726785875215777823> - Checking file
                                            <:pending:726786878711398430> - Converting file
                                            <:pending:726786878711398430> - Upload the file to S3
                                            <:pending:726786878711398430> - Add to the Database
                                        `)
                            .setColor("#FF0000")
                            .setFooter(message.author.tag, message.author.avatarURL());
                        msg.edit(embed);
                        fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                        return message.author.send("Updating tag failed");
                    } else convertAndDb(doc, msg, embed, message, tags);
                } else {
                    embed = new Discord.MessageEmbed()
                        .setTitle("Uploading file - Failed")
                        .setDescription(`
                                        <:check:726782736617963561> - Downloading file
                                        <:failure:726785875215777823> - Checking file
                                        <:pending:726786878711398430> - Converting file
                                        <:pending:726786878711398430> - Upload the file to S3
                                        <:pending:726786878711398430> - Add to the Database
                                    `)
                        .setColor("#FF0000")
                        .setFooter(message.author.tag, message.author.avatarURL());
                    msg.edit(embed);
                    fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                    return message.author.send("Cancelled");
                }
            })
    } else {
        doc.authorName = tags.artist;
        convertAndDb(doc, msg, embed, message, tags);
    }
}

function convertAndDb(doc, msg, embed, message, tags) {
    ffmpeg.ffprobe(`./tmp/download/${doc._id}.mp3`, (err, metadata) => {
        if (Math.round(metadata.streams[0].bit_rate / 1000) > 128) {
            embed
                .setDescription(`
                    <:check:726782736617963561> - Downloading file
                    <:check:726782736617963561> - Checking file
                    <a:loading:726782135792566388> - Converting file
                    <:pending:726786878711398430> - Upload the file to S3
                    <:pending:726786878711398430> - Add to the Database
                `);
            msg.edit(embed);

            ffmpeg(`./tmp/download/${doc._id}.mp3`)
                .audioCodec("libmp3lame")
                .noVideo()
                .save(`./tmp/conversion/${doc._id}.mp3`)
                .audioBitrate(128)
                .outputOption("-id3v2_version 3")
                .on("error", err => {
                    if (err) {
                        console.error(err)
                        embed
                            .setTitle("Uploading file - Failed")
                            .setDescription(`
                                <:check:726782736617963561> - Downloading file
                                <:check:726782736617963561> - Checking file
                                <:failure:726785875215777823> - Converting file
                                <:pending:726786878711398430> - Upload the file to S3
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
                .on("end", () => {
                    embed
                        .setDescription(`
                            <:check:726782736617963561> - Downloading file
                            <:check:726782736617963561> - Checking file
                            <:check:726782736617963561> - Converting file
                            <a:loading:726782135792566388> - Upload the file to S3
                            <:pending:726786878711398430> - Add to the Database
                        `);
                    msg.edit(embed);
                    fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                    const stream = fs.createReadStream(`./tmp/conversion/${doc._id}.mp3`);
                    const params = {
                        Bucket: config.s3.bucket,
                        Key: `${doc._id}.mp3`,
                        Body: stream,
                        ACL: "public-read"
                    };
                    s3.upload(params, (err, data) => {
                        if (err) {
                            embed
                                .setTitle("Uploading file - Failed")
                                .setDescription(`
                                    <:check:726782736617963561> - Downloading file
                                    <:check:726782736617963561> - Checking file
                                    <:check:726782736617963561>  - Converting file
                                    <:failure:726785875215777823> - Upload the file to S3
                                    <:pending:726786878711398430> - Add to the Database
                                `)
                                .setColor("#FF0000")
                                .setFooter(message.author.tag, message.author.avatarURL());
                            msg.edit(embed);
                            return fs.unlinkSync(`./tmp/conversion/${doc._id}.mp3`);
                        } else {
                            embed
                                .setDescription(`
                                    <:check:726782736617963561> - Downloading file
                                    <:check:726782736617963561> - Checking file
                                    <:check:726782736617963561> - Converting file
                                    <:check:726782736617963561> - Upload the file to S3
                                    <a:loading:726782135792566388> - Add to the Database
                                `);
                            msg.edit(embed);
                            fs.unlinkSync(`./tmp/conversion/${doc._id}.mp3`);
                            doc.save();
                            embed
                                .setDescription(`
                                    <:check:726782736617963561> - Downloading file
                                    <:check:726782736617963561> - Checking file
                                    <:check:726782736617963561> - Converting file
                                    <:check:726782736617963561> - Upload the file to S3
                                    <:check:726782736617963561> - Add to the Database
                                `)
                                .setColor("#7AC853");
                            msg.edit(embed);
                        }
                    });
                });
        } else {
            const stream = fs.createReadStream(`./tmp/download/${doc._id}.mp3`);
            const params = {
                Bucket: config.s3.bucket,
                Key: `${doc._id}.mp3`,
                Body: stream,
                ACL: "public-read"
            };
            s3.upload(params, (err, data) => {
                if (err) {
                    embed
                        .setTitle("Uploading file - Failed")
                        .setDescription(`
                                    <:check:726782736617963561> - Downloading file
                                    <:check:726782736617963561> - Checking file
                                    <:skip:726787489930412042> - Converting file
                                    <:failure:726785875215777823> - Upload the file to S3
                                    <:pending:726786878711398430> - Add to the Database
                                `)
                        .setColor("#FF0000")
                        .setFooter(message.author.tag, message.author.avatarURL());
                    msg.edit(embed);
                    return fs.unlinkSync(`./tmp/conversion/${doc._id}.mp3`);
                } else {
                    embed
                        .setDescription(`
                                    <:check:726782736617963561> - Downloading file
                                    <:check:726782736617963561> - Checking file
                                    <:skip:726787489930412042> - Converting file
                                    <:check:726782736617963561> - Upload the file to S3
                                    <a:loading:726782135792566388> - Add to the Database
                                `);
                    msg.edit(embed);
                    fs.unlinkSync(`./tmp/download/${doc._id}.mp3`);
                    doc.save();
                    embed
                        .setDescription(`
                                    <:check:726782736617963561> - Downloading file
                                    <:check:726782736617963561> - Checking file
                                    <:skip:726787489930412042> - Converting file
                                    <:check:726782736617963561> - Upload the file to S3
                                    <:check:726782736617963561> - Add to the Database
                                `)
                        .setColor("#7AC853");
                    msg.edit(embed);
                }
            });
        }
    });
}