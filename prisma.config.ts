import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schemas',
	datasource: {
		url: env('DATABASE_URL'),
	},
});
