import e from 'express';
import {
  getMeController,
  loginCallbackController,
  loginController,
  logoutController,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
const router = e.Router();

router.get('/auth/google/login', loginController);
router.get('/auth/google/callback', loginCallbackController);
router.get('/auth/logout', authenticate, logoutController);
router.get('/auth/me', authenticate, getMeController);

export const authRouter = router;
