/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { envSchema } from '../zodSchema/env.validation.js';

const envParser = envSchema.safeParse(process.env);
if (envParser.error) {
  console.error('❌ Environment validation failed:', JSON.stringify(envParser.error.format(), null, 2));
}

// Fallback to process.env if parsing fails
export const env = envParser.success ? envParser.data : (process.env as any);
export const envError = envParser.error;
