// Imports
const trivia = require('$/util/trivia');

exports.run = (client, message) => {
	trivia.restart(message);
};

exports.config = {
	command: 'triviatrain',
};
