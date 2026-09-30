import { uploadPrototypeFile } from '../../../../../services/prototype-files'
export default defineEventHandler(event => uploadPrototypeFile(event, true))
