import e from 'express';
import {
  createProject,
  generateVideo,
  getProjectById,
  getProjects,
} from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = e.Router();

router.route('/projects').post(
  authenticate,
  upload.fields([
    { name: 'productImage', maxCount: 1 },
    { name: 'modelImage', maxCount: 1 },
  ]),
  createProject,
);
router.post('/generate-video', authenticate, generateVideo);
router.get('/projects', authenticate, getProjects);
router.get('/projects/:id', authenticate, getProjectById);

export const projectRouter = router;
