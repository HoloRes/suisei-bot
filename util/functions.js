const Discord = require("discord.js");

exports.confirmRequest = (msg, authorId) => {
    return new Promise((resolve, reject) => {
        msg.react("726782736617963561").then(() => { // Confirm reaction
            msg.react("726785875215777823"); // Cancel reaction
        });
        const filter = (reaction, user) => {
            return ["726782736617963561", "726785875215777823"].includes(reaction.emoji.id) && user.id === authorId;
        };
        const collector = msg.createReactionCollector(filter, {time: 30000});

        collector.on("collect", r => {
            collector.stop();
            if (r.emoji.id === "726782736617963561") {
                resolve(true);
            } else resolve(false);
        });

        collector.on("end", collected => {
           if(collected.size === 0) resolve(false);
        });
    });
}