import type { Request, Response } from 'express';
import {
  createProjectService,
  generateVideoService,
} from '../services/project.service.ts';

export async function createProject(req: Request, res: Response) {
  try {
    const project = await createProjectService(req);
    res.json({
      success: true,
      data: project,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Project creation failed',
    });
  }
}
export async function generateVideo(req: Request, res: Response) {
  try {
    const project = await generateVideoService(req);
    res.json({
      success: true,
      data: project,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Project creation failed',
    });
  }
}
