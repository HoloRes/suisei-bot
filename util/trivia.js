// Imports
const axios = require('axios');
const { scheduleJob } = require('node-schedule');
const { decode } = require('html-entities');
const { MessageEmbed } = require('discord.js');
const Sentry = require('@sentry/node');

// Local files
const { logger, client } = require('$/index');

// Models
const Setting = require('$/models/setting');

// Init
Sentry.configureScope((scope) => {
	scope.setTag('module', 'Moderation');
});

// Variables
let currentSchedule;
let nonAnsweredQuestions = 0;
const currentQuestion = {};

async function sendQuestion() {
	// if (nonAnsweredQuestions === 3) currentSchedule.cancel();
	const channelSetting = await Setting.findById('triviaChannel').lean().exec()
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'trivia', event: 'databaseSearch' } });
			throw new Error(err);
		});
	if (!channelSetting) return;

	const channel = await client.channels.fetch(channelSetting.value)
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'trivia', event: 'discord' } });
			throw new Error(err);
		});

	const { data } = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple')
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'trivia', event: 'jservice' } });
			throw new Error(err);
		});
	const question = data.results[0];
	currentQuestion.question = question;

	const embed = new MessageEmbed()
		.setTitle(question.question)
		.setDescription(`**Category:** ${question.category}`)
		.setTimestamp();

	const msg = await channel.send(embed);
	currentQuestion.messageId = msg.id;
	const filter = (collectedMsg) => !collectedMsg.author.bot;
	const collector = channel.createMessageCollector(filter, { time: 45 * 1000 });
	collector.on('collect', (collectedMsg) => {
		const correntAnswer = decode(question.correct_answer);
		// TODO: Check answer and if correct, set a one second timeout until the collector stops.
	});
	collector.on('end', (collected) => {
		if (collected.size === 0) nonAnsweredQuestions += 1;
	});
}
exports.sendQuestion = sendQuestion;

function finishQuestion() {

}

exports.skipCurrentQuestion = () => {
	currentSchedule.cancelNext();
};

exports.restart = () => {
	nonAnsweredQuestions = 0;
	/* currentSchedule = scheduleJob('*\/1 * * * *', () => {
		sendQuestion();
	}); */
};

exports.init = () => {
	/* currentSchedule = scheduleJob('*\/1 * * * *', () => {
		sendQuestion();
	}); */
};
