import type { OwnerPropertyRecord } from '../owner-portal.repository'

export type OwnerPropertyResponse = ReturnType<typeof mapOwnerProperty>

export function mapOwnerProperty(property: OwnerPropertyRecord) {
  return {
    id: property.id,
    title: property.title,
    addressLine: property.addressLine,
    city: property.city,
    province: property.province,
    propertyType: property.propertyType,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  }
}
