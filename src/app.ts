import cookie from 'cookie-parser';
import cors from 'cors';
import e, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import type { HttpError } from 'http-errors';
import createHttpError from 'http-errors';
import dns from 'node:dns';
import { logger } from './config/winstonLogger.ts';
import { authRouter } from './routes/auth.route.ts';
import { projectRouter } from './routes/project.route.ts';

// Force IPv4 priority for all network requests to avoid broken NAT64/IPv6 timeouts
dns.setDefaultResultOrder('ipv4first');

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
