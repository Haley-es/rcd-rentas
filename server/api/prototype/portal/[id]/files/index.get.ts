import { listPrototypeFiles } from '../../../../../services/prototype-files'
export default defineEventHandler(event => listPrototypeFiles(event, true))
