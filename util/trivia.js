// Imports
const axios = require('axios');
const { decode } = require('html-entities');
const { MessageEmbed } = require('discord.js');
const Sentry = require('@sentry/node');
const humanizeDuration = require('humanize-duration');

// Local files
const { logger, client } = require('$/index');

// Models
const Setting = require('$/models/setting');

// Init
Sentry.configureScope((scope) => {
	scope.setTag('module', 'Moderation');
});

// Variables
let active = false;
let nonAnsweredQuestions = 0;
let customQuestions = [];

async function sendQuestion() {
	const channelSetting = await Setting.findById('triviaTrainChannel').lean().exec()
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
			logger.error(err, { labels: { module: 'trivia', event: 'opentdb' } });
			throw new Error(err);
		});

	let customOrOtdb = Math.floor(Math.random() * 100);
	if (customQuestions.length === 0) customOrOtdb = 2;

	let question;
	// eslint-disable-next-line prefer-destructuring
	if (customOrOtdb % 2 === 0) question = data.results[0];
	else {
		const index = Math.floor(Math.random() * customQuestions.length);
		question = customQuestions[index];
	}
	// eslint-disable-next-line max-len
	let correctAnswer = customOrOtdb % 2 === 0 ? [decode(question.correct_answer).toLowerCase()] : [];
	// eslint-disable-next-line max-len
	if (customOrOtdb % 2 !== 0) correctAnswer = question.answers.map((answer) => answer.toLowerCase());

	const embed = new MessageEmbed()
		.setTitle(decode(question.question))
		.setDescription(`**Category:**\n${question.category || 'N/A'}`)
		.setFooter('Powered by Open Trivia Database')
		.setTimestamp();

	await channel.send(embed);
	const date = new Date();

	let answered = false;
	const correctAnswers = [];
	const correctAnswersAuthorIds = [];
	const filter = (collectedMsg) => !collectedMsg.author.bot;
	const collector = channel.createMessageCollector(filter, { time: 45 * 1000 });
	collector.on('collect', (collectedMsg) => {
		if (correctAnswersAuthorIds.indexOf(collectedMsg.author.id) !== -1) return;

		const answer = collectedMsg.content.toLowerCase();
		if (answered === false && correctAnswer.indexOf(answer) !== -1) {
			channel.send('First answer received, answers within 1 second will be counted.');
			setTimeout(() => {
				collector.stop();
			}, 1000);
			correctAnswers.push({
				user: collectedMsg.author,
				time: new Date() - date,
			});
			correctAnswersAuthorIds.push(collectedMsg.author.id);
			answered = true;
		} else if (answered === true && correctAnswer.indexOf(answer) !== -1) {
			correctAnswers.push({
				user: collectedMsg.author,
				time: new Date() - date,
			});
			correctAnswersAuthorIds.push(collectedMsg.author.id);
		}
	});
	collector.on('end', (collected) => {
		if (collected.size === 0) {
			channel.send('No winners!');
			nonAnsweredQuestions += 1;
		} else {
			const winnersList = correctAnswers.map((answer) => `\`${answer.user.tag}\` in ${humanizeDuration(answer.time, { largest: 2, round: true })}`);
			const winnersEmbed = new MessageEmbed()
				.setTitle('Results:')
				.setDescription(`**Answer:** ${correctAnswer.join(', ')}`)
				.addField('Winners', winnersList.join('\n'))
				.setFooter('Powered by Open Trivia Database')
				.setTimestamp();
			channel.send(winnersEmbed);
		}

		if (nonAnsweredQuestions === 3) {
			active = false;
			return channel.send('Three questions in a row have been unanswered, restart training with the following command `/triviatrain`');
		}
		setTimeout(() => {
			channel.send('Trivia in 15 seconds!');
		}, 45 * 1000);
		setTimeout(() => {
			sendQuestion();
		}, 60 * 1000);
	});
}

exports.restart = (message) => {
	if (active === false) {
		nonAnsweredQuestions = 0;
		sendQuestion();
		active = true;
	} else message.reply('a session is already ongoing.');
};

async function reload() {
	const customTriviaSetting = await Setting.findById('triviaQuestionsUrl').lean().exec()
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'trivia', event: 'databaseSearch' } });
			throw new Error(err);
		});
	if (customTriviaSetting) {
		const { data } = await axios.get(customTriviaSetting.value)
			.catch((err) => {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'trivia', event: 'axios' } });
				throw new Error(err);
			});
		customQuestions = data;
	}
}
exports.reload = reload;

exports.init = async () => {
	reload();
	// TODO: Set up auto locking and unlocking of Trivia channel
};
