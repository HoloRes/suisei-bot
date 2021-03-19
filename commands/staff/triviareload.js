// Imports
const trivia = require('$/util/trivia');

exports.run = (client, message) => {
	message.channel.send('Reloading custom trivia questions.');
	trivia.reload();
};

exports.config = {
	command: 'triviareload',
};
