import { GoogleGenAI } from '@google/genai';
import { config } from './index.ts';

export const ai = config.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: config.GOOGLE_GEMINI_API_KEY, apiVersion: 'v1beta' as any })
  : null;
