import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
