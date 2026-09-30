import { initializeUploadRoot } from '../utils/prototype-file-storage'

export default defineNitroPlugin(async () => {
  await initializeUploadRoot()
})
