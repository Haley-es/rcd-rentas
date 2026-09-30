import { PrismaClient } from '@prisma/client'

const globals = globalThis as typeof globalThis & { prototypePrisma?: PrismaClient }
export const prisma = globals.prototypePrisma ?? new PrismaClient({
  errorFormat: 'minimal',
  log: [],
})
globals.prototypePrisma = prisma
