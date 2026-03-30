type Project = {
  user: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    googleId: string;
    email: string;
    picture: string | null;
    loginType: loginType;
    credits: number;
  };
} & {
  id: string;
  projectName: string;
  productName: string;
  productDescription: string | null;
  userPrompt: string | null;
  productImage: string;
  modelImage: string;
  generatedImage: string;
  generatedVideo: string;
  aspectRatio: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};
type GenerateImageInput = {
  userPrompt?: string;
  aspectRatio?: string;
};
