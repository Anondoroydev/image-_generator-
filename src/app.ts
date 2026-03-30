import cookie from 'cookie-parser';
import cors from 'cors';
import e, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import type { HttpError } from 'http-errors';
import { authRouter } from './routes/auth.route.js';
import { projectRouter } from './routes/project.route.js';

const app = e();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl)
      if (!origin) return callback(null, true);
      const allowed = ['http://localhost:5173', 'http://localhost:5000'];
      // Allow any vercel.app subdomain
      if (origin.endsWith('.vercel.app') || allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
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
  } catch (err: unknown) {
    dbStatus = `failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  res.json({
    status: 'ok',
    env: envError
      ? { status: 'invalid', errors: envError.format() }
      : { status: 'valid' },
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', authRouter);
app.use('/api/v1', projectRouter);

app.use(function (
  err: HttpError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  _next: NextFunction,
) {
  const status = err.status || 500;
  res.status(status).json({
    status: 'error',
    message: err.message || 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

export { app };
