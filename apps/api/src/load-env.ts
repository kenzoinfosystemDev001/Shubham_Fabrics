import { resolve } from 'path';
import { config } from 'dotenv';

// Loads apps/api/.env (this file sits one level below apps/api in both src/ and dist/).
// Must be the first import in main.ts: @subham/database reads DATABASE_URL as soon as it is imported.
// Variables already set in the environment (e.g. on Render) take precedence over the file.
config({ path: resolve(__dirname, '../.env') });
