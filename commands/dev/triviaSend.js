// Imports
const trivia = require('$/util/trivia');

exports.run = () => {
	trivia.sendQuestion();
};

exports.config = {
	command: 'triviasend',
};
