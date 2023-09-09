module.exports = {
	extends: [
		'plugin:import/recommended',
		'plugin:import/typescript',
		'airbnb-base',
		'airbnb-typescript/base',
		'plugin:@typescript-eslint/recommended-type-checked',
		'plugin:@typescript-eslint/stylistic-type-checked',
	],
	parserOptions: {
		project: './tsconfig.eslint.json',
	},
	plugins: [
		'@typescript-eslint',
		'import',
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
		indent: 'off',
		'no-tabs': 'off',
		'no-restricted-syntax': 'off',
		'@typescript-eslint/indent': ['error', 'tab'],
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
		'no-console': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
	},
};
