import type { Request, Response } from 'express';
import {
  createProjectService,
  generateVideoService,
  getProjectByIdService,
  getProjectsService,
} from '../services/project.service.js';

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
export async function getProjects(req: Request, res: Response) {
  try {
    const userId = (req.user as { id: string })?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const projects = await getProjectsService(userId);
    res.json({ success: true, data: projects });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to get projects' });
  }
}

export async function getProjectById(req: Request, res: Response) {
  try {
    const userId = (req.user as { id: string })?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const projectId = req.params.id as string;
    const project = await getProjectByIdService(projectId, userId);
    res.json({ success: true, data: project });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to get project' });
  }
}
