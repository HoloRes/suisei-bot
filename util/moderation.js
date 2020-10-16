// Imports
// Packages
const {client} = require("$/index"),
    { Client: ElasticClient } = require("@elastic/elasticsearch"),
    sequence = require("es-sequence");

// Local files
const config = require("$/config.json")

// Init
const elasticClient = new ElasticClient({ node: config.elasticUrl });
sequence.init(elasticClient)

// Exports
exports.warn = (user, reason, moderator) => {
    sequence.get('case_id').then((caseID) => {
        elasticClient.index({
            id: caseID,
            index: "moderation",
            body: {
                caseID: caseID,
                userID: user.id,
                lastKnownTag: user.tag,
                type: "warn",
                responsibleID: moderator.id,
                reason: reason
            }
        });
    });
}

exports.mute = (user, strike, duration, reason, moderator) => {
    sequence.get('case_id').then((caseID) => {
        elasticClient.index({
            id: caseID,
            index: "moderation",
            body: {
                caseID: caseID,
                userID: user.id,
                lastKnownTag: user.tag,
                type: "mute",
                duration: duration,
                responsibleID: moderator.id,
                reason: reason
            }
        });
        if (strike === true) elasticClient.index({
            id: caseID,
            index: "strikes",
            body: {} // TODO: Empty body and let the client do another call to the moderation index or add the data another time but less requests?
        });
    })
}

exports.kick = (user, reason, moderator) => {

}

exports.ban = (user, reason, moderator) => {

}

exports.strike = (user, reason, moderator) => { // This will automatically apply the next strike

}

exports.getModLogByUserID = (user) => {

}

exports.getModLogByCaseID = (caseID) => {

}

exports.getMemberFromMessage = (message, args, next) => {
    if(message.mentions.members.size === 1) {
        return next(message.mentions.members.array()[0]);
    } else {
        message.guild.members.fetch(args[0])
            .then((member) => {
                return next(member);
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
                        return next(member);
                    });
            })
    }
}

exports.firstInit = function () { // This should run when the Elasticsearch node hasn't been set up beforehand
    elasticClient.ilm.putLifecycle({
        policy: "strikeExpiration",
        body: {
            policy: {
                phases: {
                    hot: {
                        actions: {
                            rollover: {
                                max_age: "30d"
                            }
                        }
                    },
                    delete: {
                        actions: {
                            delete: {}
                        }
                    }
                }
            }
        }
    });
    elasticClient.indices.create({
        index: "strikes_template",
        body: {
            index_patterns: ["strikes"],
            data_stream: {},
            template: {
                settings: {
                    "index.lifecycle.name": "strikeExpiration",
                    number_of_shards: 1
                }
            }
        }
    });

    elasticClient.indices.create({ index: "bans" });
    elasticClient.indices.create({ index: "mutes" }); // This index is here to make searches less expensive
    elasticClient.indices.create({ // This will hold all moderation actions, including expired strikes
        index: "moderation",
        body: {
            mappings: {
                properties: {
                    caseID: {type: "keyword"}, // Case ID is added here so it gets indexed when searched
                    userID: {type: "keyword"},
                    lastKnownTag: {type: "keyword", index: false},
                    duration: {type: "keyword", index: false},
                    type: {type: "keyword"},
                    responsibleID: {type: "keyword"},
                    reason: {type: "text", index: false}
                }
            }
        }
    });
}