exports.confirmRequest = (msg, authorId) => new Promise((resolve, reject) => {
	try {
		msg.react('726782736617963561').then(() => { // Confirm reaction
			msg.react('726785875215777823'); // Cancel reaction
		});
		const filter = (reaction, user) => ['726782736617963561', '726785875215777823'].includes(reaction.emoji.id) && user.id === authorId;
		const collector = msg.createReactionCollector(filter, { time: 30000 });

		collector.on('collect', (r) => {
			collector.stop();
			if (r.emoji.id === '726782736617963561') {
				resolve(true);
			} else resolve(false);
		});

		collector.on('end', (collected) => {
			if (collected.size === 0) resolve(false);
		});
	} catch (e) {
		reject(new Error(e));
	}
});
