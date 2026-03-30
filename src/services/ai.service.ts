/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ai } from '../config/ai.js';
import { cloudinary } from '../config/cloudinary.js';
import { config } from '../config/index.js';
import { logger } from '../config/winstonLogger.js';
import convertImageToBase64 from '../utils/convertImageToBase64.js';
import axios from 'axios';
import { inspect } from 'node:util';
import type { Project } from '@prisma/client';
import https from 'node:https';
import dns from 'node:dns';

// Force global DNS resolution to prioritize IPv4 for compatibility in NAT64 environments
dns.setDefaultResultOrder('ipv4first');

// Force global HTTPS agent to use IPv4 to fix libraries like Cloudinary SDK
if (https.globalAgent) {
  (https.globalAgent as any).options = (https.globalAgent as any).options || {};
  (https.globalAgent as any).options.family = 4;
}

// Force axios to prioritize IPv4 to avoid broken NAT64 (IPv6) timeouts
const axiosInstance = axios.create({
  family: 4,
  timeout: 300000, // 5 minutes for generation
});

type GenerateImageInput = {
  aspectRatio?: string | undefined;
  userPrompt?: string | undefined;
  productName?: string | undefined;
  productDescription?: string | undefined;
};

const isHuggingFaceEnabled = Boolean(config.HUGGINGFACE_API_KEY);
const isGoogleGeminiEnabled = Boolean(config.GOOGLE_GEMINI_API_KEY && ai);

const generateHuggingFaceImage = async (promptText: string) => {
  const model =
    config.HUGGINGFACE_IMAGE_MODEL ?? 'black-forest-labs/FLUX.1-schnell';
  const url = `https://router.huggingface.co/hf-inference/models/${model}`;

  try {
    console.log(`[HF] Requesting image generation from ${model}...`);
    logger.info(`[HF] Prompt: ${promptText.substring(0, 100)}...`);

    const response = await axiosInstance.post(
      url,
      {
        inputs: promptText,
        options: { wait_for_model: true },
      },
      {
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${config.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'image/png',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    );

    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] ?? 'image/png';

    if (contentType.includes('application/json')) {
      const errorMsg = buffer.toString('utf8');
      throw new Error(`Hugging Face API Error: ${errorMsg}`);
    }

    console.log(`[HF] Generation Success! Size: ${buffer.length} bytes`);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err: any) {
    const errorMsg = err.response?.data?.toString() || err.message;
    console.error(`[HF] Failure: ${errorMsg}`);
    throw new Error(`Hugging Face Generation Failed: ${errorMsg}`);
  }
};

const generateHuggingFaceVideo = async (promptText: string) => {
  const model =
    config.HUGGINGFACE_VIDEO_MODEL ?? 'damo-vilab/text-to-video-synthesis';
  const response = await axiosInstance.post(
    `https://router.huggingface.co/hf-inference/models/${model}`,
    {
      inputs: promptText,
      options: {
        wait_for_model: true,
      },
    },
    {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${config.HUGGINGFACE_API_KEY}`,
        Accept: 'application/octet-stream',
      },
    },
  );

  const contentType = response.headers['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    const errorJson = JSON.parse(Buffer.from(response.data).toString('utf8'));
    throw new Error(`Hugging Face video error: ${JSON.stringify(errorJson)}`);
  }
  if (!contentType.startsWith('video/')) {
    throw new Error(`Unexpected Hugging Face video response: ${contentType}`);
  }

  const fileName = `video-${Date.now()}.mp4`;
  const filePath = path.join('videos', fileName);
  mkdirSync('videos', { recursive: true });
  await writeFile(filePath, Buffer.from(response.data));

  const upload = await cloudinary.uploader.upload(filePath, {
    folder: 'ai-shorts',
    resource_type: 'video',
  });
  return upload.secure_url;
};

export async function generateImageWithAI(
  productImage: Express.Multer.File | string,
  modelImage: Express.Multer.File | string,
  body: GenerateImageInput,
) {
  const productInfo =
    `${body.productName || ''} ${body.productDescription || ''}`.trim();
  let placement = '';
  if (productInfo.toLowerCase().includes('watch'))
    placement = " worn on the model's wrist";
  else if (
    productInfo.toLowerCase().includes('bag') ||
    productInfo.toLowerCase().includes('purse')
  )
    placement = ' held by the model';
  else if (
    productInfo.toLowerCase().includes('necklace') ||
    productInfo.toLowerCase().includes('earring')
  )
    placement = ' worn by the model';
  else if (
    productInfo.toLowerCase().includes('shirt') ||
    productInfo.toLowerCase().includes('dress') ||
    productInfo.toLowerCase().includes('jacket')
  )
    placement = ' worn by the model';

  let finalPrompt =
    body.userPrompt ||
    (productInfo
      ? `Professional e-commerce photography of ${productInfo}${placement}, high quality, realistic`
      : 'High quality e-commerce product photography');

  // 1. Stage 1: Vision-based Prompt Engineering via Gemini (Using @google/genai v1 SDK)
  if (isGoogleGeminiEnabled && ai) {
    try {
      logger.info(
        'Stage 1: Using Gemini to analyze images and generate a rich prompt...',
      );

      const getImagePart = async (input: Express.Multer.File | string) => {
        if (typeof input === 'string') {
          if (input.startsWith('http')) {
            const response = await axiosInstance.get(input, {
              responseType: 'arraybuffer',
              timeout: 30000,
            });
            return {
              inlineData: {
                mimeType: response.headers['content-type'] || 'image/png',
                data: Buffer.from(response.data).toString('base64'),
              },
            };
          }
          return {
            inlineData: {
              mimeType: input.match(/:(.*?);/)?.[1] || 'image/png',
              data: input.split(',')[1] || '',
            },
          };
        }
        const b64 = convertImageToBase64(input.path, input.mimetype);
        return b64 as any;
      };

      const productPart = await getImagePart(productImage);
      const modelPart = await getImagePart(modelImage);

      const visionPrompt = `Look at these two images: a Product and a Model. 
      Analyze the SPECIFIC identifying features of BOTH the Product and the Model.
      1. For the PRODUCT: Identify what it is (e.g., watch, bag, jewelry, clothing). Note its exact color, texture, shape, and unique style.
      2. For the MODEL: Describe their features, hairstyle, clothing, and natural pose.
      
      Generate an extremely detailed visual prompt for a text-to-image model (like FLUX) to create a photo where THIS SPECIFIC MODEL is naturally showcasing THIS SPECIFIC PRODUCT. 
      IMPORTANT: The placement must be LOGICAL and AESTHETIC:
      - If the product is a watch, it MUST be worn on the model's wrist.
      - If it is a bag, it should be held in hand or over the shoulder.
      - If it is jewelry, it should be worn appropriately (neck, ears, wrist).
      - If it is an object, the model should be holding it or interacting with it naturally.
      
      The resulting image must feel like professional e-commerce photography with perfect lighting and composition.
      Return ONLY the prompt text. No preamble or chatter.`;

      // Updated to gemini-2.0-flash for compatibility in this environment
      const result = await (ai as any).models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Here is the Product image:' },
              productPart,
              { text: 'Here is the Model image:' },
              modelPart,
              { text: visionPrompt },
            ],
          },
        ],
        config: {
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
          },
        },
      });

      // Robust text extraction for different SDK versions
      const text = result.response?.text?.() || result.text;

      if (text && text.trim().length > 10) {
        finalPrompt = text.trim();
        console.log(
          `[STAGE 1] Vision analysis successful. Rich prompt generated.`,
        );
        logger.info(
          `Stage 1 Success: Generated rich prompt: ${finalPrompt.substring(0, 50)}...`,
        );
      } else {
        console.log(
          `[STAGE 1] Vision analysis returned no text. Using fallback.`,
        );
      }
    } catch (error: any) {
      const quotaExceeded =
        error.message?.includes('quota') ||
        error.message?.includes('429') ||
        error.message?.includes('RESOURCE_EXHAUSTED');
      if (quotaExceeded) {
        console.log(`[STAGE 1] QUOTA EXCEEDED. Using fallback prompt.`);
        logger.warn(
          `Stage 1 Gemini reached quota. Using fallback prompt from metadata: ${finalPrompt}`,
        );
      } else {
        console.log(`[STAGE 1] FAILED: ${error.message}`);
        logger.warn(
          `Stage 1 (Gemini Vision) failed, using fallback: ${error.message || inspect(error)}`,
        );
      }
    }
  }

  // 2. Stage 2: Generation via Hugging Face (FLUX)
  console.log(
    `[STAGE 2] Final prompt being sent to Hugging Face: "${finalPrompt}"`,
  );

  let base64Image: string | undefined;
  if (isHuggingFaceEnabled) {
    try {
      logger.info(
        'Stage 2: Sending rich prompt to Hugging Face for image generation...',
      );
      base64Image = await generateHuggingFaceImage(finalPrompt);
    } catch (error: any) {
      logger.error(
        `Stage 2 (Hugging Face) failed: ${error.message || inspect(error)}`,
      );
      throw new Error(
        `AI generation failed. HF Error: ${error.message || 'Unknown network error'}`,
      );
    }
  }

  if (!base64Image) {
    throw new Error('No AI provider succeeded in generating an image.');
  }

  // 3. Upload Result to Cloudinary
  const upload = await cloudinary.uploader.upload(base64Image, {
    folder: 'ai-shorts',
  });

  return upload.secure_url;
}

export async function generateVideoWithAi(
  project: Project & { user: { name: string } },
) {
  const prompt = `Make the person showcase the product which is ${project.productName} ${project.productDescription}`;
  if (isHuggingFaceEnabled) {
    try {
      return await generateHuggingFaceVideo(prompt);
    } catch (error) {
      logger.error(
        'Hugging Face video generation failed:',
        JSON.stringify(error, null, 2),
      );
      throw new Error(
        'Video generation failed. Your credits have been refunded.',
      );
    }
  }

  throw new Error(
    'Video generation is currently unsupported in this configuration.',
  );
}
