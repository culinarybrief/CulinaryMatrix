import { PrismaClient } from '@prisma/client';
const globalAny = global as any;
export const prisma: PrismaClient = globalAny.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalAny.prisma = prisma;
