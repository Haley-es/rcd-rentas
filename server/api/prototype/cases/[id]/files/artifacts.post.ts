import { generatePrototypeSeedArtifacts } from '../../../../../services/prototype-files'
export default defineEventHandler(event => generatePrototypeSeedArtifacts(event))
