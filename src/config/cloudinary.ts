import { v2 as cloudinary } from 'cloudinary';
import { config } from './index.js';

import { logger } from './winstonLogger.js';

logger.info(`Cloudinary configured with cloud_name: ${config.CLOUDINARY_CLOUD_NAME}`);

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

export { cloudinary };
