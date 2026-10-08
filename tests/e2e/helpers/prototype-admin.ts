import { parseEnv } from 'node:util'
import { prototypeAdminSeed, prototypeEmployeeSeed, seedPrototypeUserContents } from '../../../prisma/seed.mjs'

// The isolated server uses the same account and seeding logic as the local demo.
// It never reads or modifies the development administrator configuration.
export const prototypeAdmin = prototypeAdminSeed
export const prototypeEmployee = prototypeEmployeeSeed
export const prototypeAdminEnvironment = parseEnv(seedPrototypeUserContents('').contents)
