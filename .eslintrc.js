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
	settings: {
		'import/parsers': {
			'@typescript-eslint/parser': ['.ts'],
		},
		'import/resolver': {
			typescript: {
				alwaysTryTypes: true,
			},
		},
	},
	rules: {
		indent: ['error', 'tab'],
		'no-tabs': 'off',
		'no-plusplus': ['error', {
			allowForLoopAfterthoughts: true,
		}],
		'import/extensions': [
			'error',
			'ignorePackages',
			{
				js: 'never',
				ts: 'never',
			},
		],
		'import/no-extraneous-dependencies': 'off',
		'import/prefer-default-export': 'off',
		'class-methods-use-this': 'off',
	},
};
