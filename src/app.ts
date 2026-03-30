import cookie from 'cookie-parser';
import cors from 'cors';
import e, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import type { HttpError } from 'http-errors';
import createHttpError from 'http-errors';
import { logger } from './config/winstonLogger.js';
import { authRouter } from './routes/auth.route.js';
import { projectRouter } from './routes/project.route.js';

const app = e();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5000'],
  credentials: true,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((helmet as any)());
app.use(cookie());
app.use(e.json({ limit: '50mb' }));
app.use(e.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'AI Shorts API is running. Visit /health for status.' });
});

app.get('/health', async (req, res) => {
  const { envError } = await import('./config/env.js');
  const { prisma } = await import('./lib/prisma.js');
  
  let dbStatus = 'testing...';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err: any) {
    dbStatus = `failed: ${err.message}`;
  }

  res.json({
    status: 'ok',
    env: envError ? { status: 'invalid', errors: envError.format() } : { status: 'valid' },
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1', authRouter);
app.use('/api/v1', projectRouter);

app.get('/debug-sentry', function mainHandler() {
  throw logger.error('This is an error log 2');
});

app.use(function (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return next(createHttpError(500, 'something fishy fishy'));
});

export { app };
