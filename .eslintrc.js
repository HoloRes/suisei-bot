module.exports = {
	env: {
		es2021: true,
		node: true,
	},
	extends: [
		'airbnb-base',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 12,
		sourceType: 'module',
	},
	plugins: [
		'@typescript-eslint',
	],
	ignorePatterns: ['**/*.d.ts'],
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
