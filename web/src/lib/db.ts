import { PrismaClient } from '@prisma/client';

// Re-use a single PrismaClient in dev to avoid connection issues
const g = global as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
