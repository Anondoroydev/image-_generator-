import { prisma } from './src/lib/prisma.js';

async function main() {
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Project Images:', {
    productImage: project?.productImage,
    modelImage: project?.modelImage,
    generatedImage: project?.generatedImage
  });
}

main().finally(() => prisma.$disconnect());
