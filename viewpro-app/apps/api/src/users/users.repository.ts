import type { Prisma, User } from '@prisma/client'

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY')

export type UsersRepository = {
  create(data: Prisma.UserCreateInput): Promise<User>
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  updatePassword(userId: string, passwordHash: string): Promise<User>
}
