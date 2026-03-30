/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request } from 'express';
import { unlink } from 'node:fs/promises';
import { inspect } from 'node:util';
import { logger } from '../config/winstonLogger.js';
import { prisma } from '../lib/prisma.js';
import { generateImageWithAI, generateVideoWithAi } from './ai.service.js';

type CreateProjectBody = {
  projectName: string;
  productName: string;
  productDescription: string;
  aspectRatio?: string;
  userPrompt?: string;
  productImage?: string; // Optional if sent as base64 in JSON
  modelImage?: string;   // Optional if sent as base64 in JSON
};

export async function createProjectService(req: Request) {
  const userId = (req.user as any)?.id || (req.user as any)?.userID;
  if (!userId) {
    throw new Error('User ID not found in request. Please ensure you are authenticated.');
  }

  // 1. Fetch User and Check Credits
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found in database.');
  }

  if (user.credits < 5) {
    throw new Error(`Insufficient credits. You need 5 credits but only have ${user.credits}.`);
  }

  // 2. Resolve Images (Greedy Strategy)
  const body = req.body as CreateProjectBody;
  const rawFiles = req.files as Express.Multer.File[] | { [fieldName: string]: Express.Multer.File[] } | undefined;

  const getFile = (name: string) => {
    if (Array.isArray(rawFiles)) return rawFiles.find(f => f.fieldname === name);
    if (rawFiles && !Array.isArray(rawFiles)) return rawFiles[name]?.[0];
    return undefined;
  };

  let productImage: Express.Multer.File | string | undefined = getFile('productImage');
  let modelImage: Express.Multer.File | string | undefined = getFile('modelImage');

  // Fallback to body if fields are missing in files
  if (!productImage && body.productImage) productImage = body.productImage;
  if (!modelImage && body.modelImage) modelImage = body.modelImage;

  // Greedy Search: detect ANY images if the basics are missing
  if (!productImage || !modelImage) {
    if (Array.isArray(rawFiles) && rawFiles.length >= 2) {
      productImage = productImage || rawFiles[0];
      modelImage = modelImage || rawFiles[1];
    }
    const bodyValues = Object.values(req.body);
    const base64Values = bodyValues.filter(v => typeof v === 'string' && (v.startsWith('data:image/') || v.startsWith('http'))) as string[];
    if (base64Values.length >= 2) {
      productImage = productImage || base64Values[0];
      modelImage = modelImage || base64Values[1];
    }
  }

  // Debug Logging
  logger.info(`Project Request from ${user.email} (Credits: ${user.credits})`);
  logger.info(`Resolved Images: ${JSON.stringify({ 
    hasProduct: !!productImage, 
    hasModel: !!modelImage,
    productType: typeof productImage,
    modelType: typeof modelImage 
  }, null, 2)}`);

  if (!productImage || !modelImage) {
    throw new Error('Both productImage and modelImage are required. We checked files, fields, and common body patterns.');
  }

  // 3. Upload to Cloudinary if they are local files
  let productUrl = typeof productImage === 'string' ? productImage : '';
  let modelUrl = typeof modelImage === 'string' ? modelImage : '';

  try {
    const { cloudinary } = await import('../config/cloudinary.ts');
    
    if (typeof productImage !== 'string') {
      const pUpload = await cloudinary.uploader.upload(productImage.path, {
        folder: 'ai-shorts',
        resource_type: 'image',
      });
      if (pUpload) productUrl = pUpload.secure_url;
    }
    
    if (typeof modelImage !== 'string') {
      const mUpload = await cloudinary.uploader.upload(modelImage.path, {
        folder: 'ai-shorts',
        resource_type: 'image',
      });
      if (mUpload) modelUrl = mUpload.secure_url;
    }
  } catch (err: any) {
    logger.error(`Cloudinary upload failed: ${err.message}`);
    // If Cloudinary fails, we can't show images in frontend, but AI generation might still work if we pass local paths.
    // However, it's better to fail early if storage fails.
    throw new Error(`Failed to upload images to storage: ${err.message}`);
  }

  // 4. AI Generation
  try {
    logger.info("Calling generateImageWithAI...");
    // Passing local files or URLs to AI service
    const generatedImageUrl = await generateImageWithAI(
      productImage, // We pass the original (local file) to AI so it doesn't have to download it from Cloudinary
      modelImage,
      {
        aspectRatio: body.aspectRatio,
        userPrompt: body.userPrompt,
        productName: body.productName,
        productDescription: body.productDescription,
      },
    );
    logger.info(`Generation Success: ${generatedImageUrl}`);

    // 5. Create Project and Deduct Credits
    const project = await prisma.project.create({
      data: {
        projectName: body.projectName || 'Untitled Project',
        productName: body.productName || 'Unnamed Product',
        productDescription: body.productDescription || '',
        productImage: productUrl || (typeof productImage === 'string' ? productImage : productImage.path),
        modelImage: modelUrl || (typeof modelImage === 'string' ? modelImage : modelImage.path),
        generatedImage: generatedImageUrl,
        generatedVideo: '',
        userId: user.id,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { credits: { decrement: 5 } },
    });

    // Cleanup temp files
    if (typeof productImage !== 'string') unlink(productImage.path).catch(e => logger.warn(`Cleanup failed: ${e.message}`));
    if (typeof modelImage !== 'string') unlink(modelImage.path).catch(e => logger.warn(`Cleanup failed: ${e.message}`));

    return project;

  } catch (error: any) {
    const errMsg = (error instanceof Error && error.message.length > 0) 
      ? error.message 
      : inspect(error, { depth: 0, colors: false });
      
    logger.error(`Project creation failed: ${errMsg}`);
    logger.error(`Full Error Context: ${inspect(error, { depth: null, colors: false })}`);

    if (productImage && typeof productImage !== 'string') unlink(productImage.path).catch(() => {});
    if (modelImage && typeof modelImage !== 'string') unlink(modelImage.path).catch(() => {});

    throw new Error(`Image generation failed: ${errMsg.substring(0, 500)}. Your credits have NOT been deducted.`);
  }
}

export async function generateVideoService(req: Request) {
  const userId = (req.user as any)?.id || (req.user as any)?.userID;
  if (!userId) throw new Error('User ID not found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.credits < 10) {
    throw new Error('Insufficient credits (10 required).');
  }

  const { projectId } = req.body;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId, userId: user.id },
      include: { user: true },
    });
    if (!project || !project.generatedImage) {
      throw new Error('Valid project with generated image required.');
    }

    const generatedVideo = await generateVideoWithAi(project);

    await prisma.user.update({
      where: { id: user.id },
      data: { credits: { decrement: 10 } },
    });

    return await prisma.project.update({
      where: { id: project.id },
      data: { generatedVideo },
    });
  } catch (error: any) {
    logger.error('Video generation failed:', error);
    throw new Error(`Video generation failed: ${error.message}`);
  }
}

export async function getProjectsService(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      projectName: true,
      productName: true,
      generatedImage: true,
      generatedVideo: true,
      createdAt: true,
      aspectRatio: true,
    },
  });
}

export async function getProjectByIdService(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId, userId },
  });
  if (!project) throw new Error('Project not found');
  return project;
}
