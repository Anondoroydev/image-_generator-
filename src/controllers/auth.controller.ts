import type { Request, Response } from 'express';
import {
  getMeService,
  loginCallbackService,
  loginService,
  logoutService,
} from '../services/auth.service.ts';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../utils/cookies.ts';

async function loginController(req: Request, res: Response) {
  const url = await loginService();
  res.redirect(url);
}
async function loginCallbackController(req: Request, res: Response) {
  const code = req.query.code as string;
  const { accessToken, refreshToken } = await loginCallbackService(code);
  setRefreshTokenCookie(res, refreshToken);
  // Redirect to frontend with token
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth/callback?accessToken=${accessToken}`);
}

const logoutController = async (req: Request, res: Response) => {
  const token = req.cookies.refreshToken as string;
  const result = await logoutService(token);
  if (result) {
    clearRefreshTokenCookie(res);
  }
  res.json({ message: 'logout done' });
};

const getMeController = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id: string })?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const user = await getMeService(userId);
    res.json({ success: true, data: user });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get user',
    });
  }
};

export { getMeController, loginCallbackController, loginController, logoutController };
