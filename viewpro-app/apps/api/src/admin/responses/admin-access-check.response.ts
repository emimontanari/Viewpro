import { GlobalRole } from '@prisma/client'

export type AdminAccessCheckResponse = {
  access: 'granted'
  globalRole: typeof GlobalRole.VIEWPRO_ADMIN
}

export function createAdminAccessCheckResponse(): AdminAccessCheckResponse {
  return { access: 'granted', globalRole: GlobalRole.VIEWPRO_ADMIN }
}
