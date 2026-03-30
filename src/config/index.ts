import type { ConfigAndEnv } from '../../types/config.js';
import { env } from './env.js';
const _config: ConfigAndEnv = {
  ...env,
  APP_URL: env.APP_URL || `http://localhost:${env.PORT}`,
  GOOGLE_SCOPES: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
  ],
  HUGGINGFACE_API_KEY: env.HUGGINGFACE_API_KEY,
  HUGGINGFACE_IMAGE_MODEL: env.HUGGINGFACE_IMAGE_MODEL,
  HUGGINGFACE_VIDEO_MODEL: env.HUGGINGFACE_VIDEO_MODEL,
  WINSTON_LEVEL: 'info',
};

export const config: ConfigAndEnv = Object.freeze(_config);
