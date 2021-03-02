// Imports
const trivia = require('$/util/trivia');

exports.run = () => {
	trivia.restart();
};

exports.config = {
	command: 'triviatrain',
};
