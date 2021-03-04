module.exports = {
	env: {
		browser: false,
		node: true,
		commonjs: true,
		es2021: true,
	},
	extends: [
		'airbnb-base',
	],
	parserOptions: {
		ecmaVersion: 12,
	},
	rules: {
		indent: [2, 'tab'],
		'no-tabs': 0,
		'consistent-return': 0, // Disabled as returns are not required
		'no-underscore-dangle': 0, // Disabled as mongoose uses _id,
		'no-plusplus': ['error', {
			allowForLoopAfterthoughts: true,
		}],
	},
};
