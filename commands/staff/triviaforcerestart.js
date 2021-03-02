// Imports
const trivia = require('$/util/trivia');

exports.run = (client, message) => {
	message.channel.send('Force restarting trivia.');
	trivia.forceRestart();
};

exports.config = {
	command: 'triviaforcerestart',
};
