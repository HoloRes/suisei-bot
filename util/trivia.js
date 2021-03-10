// Imports
const axios = require('axios');
const { decode } = require('html-entities');
const { MessageEmbed } = require('discord.js');
const Sentry = require('@sentry/node');
const humanizeDuration = require('humanize-duration');
const { scheduleJob } = require('node-schedule');

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

const multipleChoiceRegex = /(which of)|(which one of)|(of the following)|(list the following)/gi;

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
	const answersNonLowercase = customOrOtdb % 2 === 0 ? decode(question.correct_answer) : question.answers.join(', ');
	// eslint-disable-next-line max-len
	let correctAnswer = customOrOtdb % 2 === 0 ? [decode(question.correct_answer).toLowerCase()] : [];
	// eslint-disable-next-line max-len
	if (customOrOtdb % 2 !== 0) correctAnswer = question.answers.map((answer) => answer.toLowerCase());
	if (multipleChoiceRegex.test(question.question) && customOrOtdb % 2 === 0) return sendQuestion();

	const embed = new MessageEmbed()
		.setTitle(decode(question.question))
		.setDescription(`**Category:**\n${question.category || 'N/A'}`)
		.setFooter('Powered by Open Trivia Database')
		.setTimestamp();

	await channel.send(embed);
	const date = new Date();

	let answered = false;
	let fiveSecondTimerPast = false;
	setTimeout(() => {
		fiveSecondTimerPast = true;
	}, 10000);

	const correctAnswers = [];
	const correctAnswersAuthorIds = [];

	const filter = (collectedMsg) => !collectedMsg.author.bot;
	const collector = channel.createMessageCollector(filter, { time: 45 * 1000 });

	collector.on('collect', (collectedMsg) => {
		if (correctAnswersAuthorIds.indexOf(collectedMsg.author.id) !== -1) return;

		const answer = collectedMsg.content.toLowerCase();
		if (answered === false && correctAnswer.indexOf(answer) !== -1) {
			if (fiveSecondTimerPast === true) {
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
			} else {
				correctAnswers.push({
					user: collectedMsg.author,
					time: new Date() - date,
				});
				correctAnswersAuthorIds.push(collectedMsg.author.id);
				answered = true;
				setTimeout(() => {
					collector.stop();
				}, 10000 - (new Date() - date));
			}
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
			channel.send(`No winners!\nAnswer: ${answersNonLowercase}`);
			nonAnsweredQuestions += 1;
		} else if (correctAnswers.length === 0) {
			nonAnsweredQuestions = 0;
			channel.send(`No winners!\nAnswer: ${answersNonLowercase}`);
		} else {
			nonAnsweredQuestions = 0;
			const winnersList = correctAnswers.map((answer) => `\`${answer.user.tag}\` in ${humanizeDuration(answer.time, {
				largest: 2,
				round: true,
				units: ['s', 'ms'],
			})}`);
			const winnersEmbed = new MessageEmbed()
				.setTitle('Results:')
				.setDescription(`**Answer:** ${answersNonLowercase}`)
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
		}, 15 * 1000);
		setTimeout(() => {
			sendQuestion();
		}, 30 * 1000);
	});
}

exports.restart = (message) => {
	if (active === false) {
		nonAnsweredQuestions = 0;
		sendQuestion();
		active = true;
	} else message.reply('a session is already ongoing.');
};

exports.forceRestart = () => {
	nonAnsweredQuestions = 0;
	sendQuestion();
	active = true;
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
};

exports.autoLockHandler = async (message) => {
	const triviaChannel = await Setting.findById('triviaChannel').lean().exec()
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'trivia', event: 'databaseSearch' } });
			throw new Error(err);
		});
	const triviaPingRole = await Setting.findById('triviaPingRole').lean().exec()
		.catch((err) => {
			Sentry.captureException(err);
			logger.error(err, { labels: { module: 'trivia', event: 'databaseSearch' } });
			throw new Error(err);
		});

	if (!triviaChannel || !triviaPingRole) return;
	if (message.channel.id === triviaChannel.value && message.author.id === '763769064572190730' && message.embeds.length > 0) {
		const channel = await client.channels.fetch(triviaChannel.value)
			.catch((err) => {
				Sentry.captureException(err);
				logger.error(err, { labels: { module: 'trivia', event: 'discord' } });
				throw new Error(err);
			});
		if (message.embeds[0].title.includes('Upcoming Trivia Battle')) {
			// 30 seconds before the start
			const date = new Date(new Date(message.embeds[0].timestamp) - 30 * 1000);
			scheduleJob(date, () => {
				// eslint-disable-next-line max-len
				const permissionOverride = channel.permissionOverwrites.find((override) => override.id === channel.guild.roles.everyone.id);
				if (permissionOverride) permissionOverride.update({ SEND_MESSAGES: true, VIEW_CHANNEL: false }, 'Automatic unlock');
				else channel.createOverwrite(channel.guild.roles.everyone, { SEND_MESSAGES: true, VIEW_CHANNEL: false }, 'Automatic unlock');
				channel.send(`<@&${triviaPingRole.value}> Trivia is starting in less than 30 seconds`);
				channel.setTopic("<a:checkthepins:677867705403047937> Please Read Trivia Rules <a:checkthepins:677867705403047937>\nIf we lose, it's Riku's fault <:Sui_Gun:818108804733730859> If we win, it's because of Suisei <:Sui_Pray:815958089769156609>");
			});
		} else if (message.embeds[0].title.includes('We have a winner')) {
			// eslint-disable-next-line max-len
			const permissionOverride = channel.permissionOverwrites.find((override) => override.id === channel.guild.roles.everyone.id);
			if (permissionOverride) permissionOverride.update({ SEND_MESSAGES: false, VIEW_CHANNEL: false }, 'Automatic lock');
			else channel.createOverwrite(channel.guild.roles.everyone, { SEND_MESSAGES: false, VIEW_CHANNEL: false }, 'Automatic lock');
			channel.send('https://tenor.com/view/hololive-hoshimachi-suisei-suityan-suisei-hoshimati-suisei-gif-20514867');
			channel.setTopic("<a:checkthepins:677867705403047937> Please Read Trivia Rules <a:checkthepins:677867705403047937>\nIf we lose, it's Riku's fault <:Sui_Gun:818108804733730859> If we win, it's because of Suisei <:Sui_Pray:815958089769156609>");
		}
	}
};
