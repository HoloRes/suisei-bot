import path from 'node:path';
import { includeIgnoreFile } from '@eslint/config-helpers';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import { configs, plugins } from 'eslint-config-airbnb-extended';

const gitignorePath = path.resolve('.', '.gitignore');

const jsConfig = defineConfig([
	{ name: 'js/config', ...js.configs.recommended },
	plugins.stylistic,
	plugins.importX,
	...configs.base.recommended,
]);

const nodeConfig = defineConfig([
	plugins.node,
	...configs.node.recommended,
]);

const typescriptConfig = defineConfig([
	plugins.typescriptEslint,
	...configs.base.typescript,
]);

export default defineConfig([
	includeIgnoreFile(gitignorePath),
	...jsConfig,
	...nodeConfig,
	...typescriptConfig,
	{
		files: ['**/*.ts', 'eslint.config.mjs'],
		rules: {
			'no-tabs': 'off',
			'no-restricted-syntax': 'off',
			'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
			'@stylistic/no-tabs': ['error', { allowIndentationTabs: true }],
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/max-len': ['error', { code: 150, ignoreStrings: true }],
			'class-methods-use-this': 'off',
			'no-console': 'off',
			'no-unused-vars': 'off',
			'import-x/prefer-default-export': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-type-imports': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-empty-object-type': 'off',
			'n/no-process-exit': 'off',
			'n/prefer-global/process': 'off',
			'n/prefer-node-protocol': 'off',
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
	{
		files: ['src/lib/types/**/*.ts'],
		rules: {
			'no-shadow': 'off',
			'@typescript-eslint/no-shadow': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'no-use-before-define': 'off',
			'@typescript-eslint/no-use-before-define': 'off',
		},
	},
]);
