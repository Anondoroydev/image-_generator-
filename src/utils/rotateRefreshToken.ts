import { prisma } from '../lib/prisma.js';
import { createSession } from '../services/auth.service.js';
import { hashToken } from './token.js';

export const rotateRefreshToken = async (token: string) => {
  const hashed = hashToken(token);

  const session = await prisma.session.findFirst({
    where: { refreshToken: hashed },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new Error('Invalid refresh token');
  }

  // Delete old token (rotation)
  await prisma.session.delete({
    where: { id: session.id },
  });

  return createSession(session.userId);
};
