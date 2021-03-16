// Imports
const trivia = require('$/util/trivia');

exports.run = (client, message) => {
	message.channel.send('Forcefully stopping trivia.');
	trivia.forceStop();
};

exports.config = {
	command: 'triviaforcestop',
};
