const {firstInit} = require("$/util/moderation");

exports.run = (client, message, args) => {
    firstInit();
    message.channel.send("Initialized Elastic database.")
}

module.exports.config = {
    command: "initElastic"
}
