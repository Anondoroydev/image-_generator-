import { google } from 'googleapis';
import { config } from '../config/index.ts';
import { prisma } from '../lib/prisma.ts';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../utils/token.ts';

// Initialize Google OAuth client
const oauth2Client = new google.auth.OAuth2(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  config.GOOGLE_REDIRECT_URL,
);

// Generate Google login URL
const loginService = async () => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.GOOGLE_SCOPES,
  });
  return url;
};

// Handle Google OAuth callback
const loginCallbackService = async (code: string) => {
  try {
    // 1️⃣ Get Google tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 2️⃣ Get user info from Google
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) throw new Error('Google account has no email');
    if (!userInfo.id) throw new Error('Google account has no ID');

    let user = await prisma.user.findUnique({ where: { googleId: userInfo.id } });

    if (!user) {
      // Check if email exists (maybe another login type)
      user = await prisma.user.findUnique({ where: { email: userInfo.email } });
    }

    if (user) {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: userInfo.name ?? 'Anonymous',
          picture: userInfo.picture ?? null,
          googleId: userInfo.id,
        },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          googleId: userInfo.id,
          name: userInfo.name ?? 'Anonymous',
          picture: userInfo.picture ?? null,
        },
      });
    }

    // 3️⃣ Create session tokens
    const { accessToken, refreshToken } = await createSession(user.id);

    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Login callback failed:', error);
    throw new Error('Failed to login with Google');
  }
};

// Create session with access & refresh tokens
const createSession = async (userId: string) => {
  const refreshToken = generateRefreshToken();
  const hashedToken = hashToken(refreshToken);

  await prisma.session.create({
    data: {
      userId,
      refreshToken: hashedToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  const accessToken = generateAccessToken(userId);

  return { accessToken, refreshToken };
};

// Logout user by deleting session
const logoutService = async (token: string) => {
  const hashed = hashToken(token);
  const result = await prisma.session.deleteMany({
    where: { refreshToken: hashed },
  });
  return result.count;
};

// Get user profile
const getMeService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      picture: true,
      credits: true,
      createdAt: true,
    },
  });
  if (!user) throw new Error('User not found');
  return user;
};

export { createSession, getMeService, loginCallbackService, loginService, logoutService };