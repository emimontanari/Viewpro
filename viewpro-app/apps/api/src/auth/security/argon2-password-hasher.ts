import { Injectable } from '@nestjs/common'
import { argon2id, hash, verify } from 'argon2'
import type { PasswordHasher } from './password-hasher'

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, { type: argon2id })
  }

  verify(hashValue: string, password: string): Promise<boolean> {
    return verify(hashValue, password)
  }
}
