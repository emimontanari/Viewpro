import { describe, it, expect } from 'vitest'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateOperatorDto } from '../create-operator.dto'
import { UpdateRoleOperatorDto } from '../update-role-operator.dto'
import { UpdateStatusOperatorDto } from '../update-status-operator.dto'

/**
 * T1.3.9 — RED: DTO validation — `CreateOperatorDto` (email format, role ∈
 * enum, `@MinLength(12)` temp password), `UpdateRoleOperatorDto`,
 * `UpdateStatusOperatorDto`.
 */
describe('CreateOperatorDto (T1.3.9)', () => {
  it('valid payload → no validation errors', async () => {
    const dto = plainToInstance(CreateOperatorDto, {
      email: 'new@viewpro.app',
      role: 'OPERATIONS',
      tempPassword: 'a-strong-temp-pw12',
    })
    expect(await validate(dto)).toHaveLength(0)
  })

  it('invalid email format → validation error on email', async () => {
    const dto = plainToInstance(CreateOperatorDto, {
      email: 'not-an-email',
      role: 'OPERATIONS',
      tempPassword: 'a-strong-temp-pw12',
    })
    const errors = await validate(dto)
    expect(errors.some((e) => e.property === 'email')).toBe(true)
  })

  it('role outside {OWNER,OPERATIONS,ANALYST} → validation error on role', async () => {
    const dto = plainToInstance(CreateOperatorDto, {
      email: 'new@viewpro.app',
      role: 'SUPERADMIN',
      tempPassword: 'a-strong-temp-pw12',
    })
    const errors = await validate(dto)
    expect(errors.some((e) => e.property === 'role')).toBe(true)
  })

  it('tempPassword shorter than 12 chars → validation error on tempPassword', async () => {
    const dto = plainToInstance(CreateOperatorDto, {
      email: 'new@viewpro.app',
      role: 'OPERATIONS',
      tempPassword: 'short1',
    })
    const errors = await validate(dto)
    expect(errors.some((e) => e.property === 'tempPassword')).toBe(true)
  })
})

describe('UpdateRoleOperatorDto (T1.3.9)', () => {
  it('valid role → no validation errors', async () => {
    const dto = plainToInstance(UpdateRoleOperatorDto, { role: 'OWNER' })
    expect(await validate(dto)).toHaveLength(0)
  })

  it('invalid role → validation error on role', async () => {
    const dto = plainToInstance(UpdateRoleOperatorDto, { role: 'GARBAGE' })
    const errors = await validate(dto)
    expect(errors.some((e) => e.property === 'role')).toBe(true)
  })
})

describe('UpdateStatusOperatorDto (T1.3.9)', () => {
  it('valid status (ACTIVE) → no validation errors', async () => {
    const dto = plainToInstance(UpdateStatusOperatorDto, { status: 'ACTIVE' })
    expect(await validate(dto)).toHaveLength(0)
  })

  it('valid status (SUSPENDED) → no validation errors', async () => {
    const dto = plainToInstance(UpdateStatusOperatorDto, { status: 'SUSPENDED' })
    expect(await validate(dto)).toHaveLength(0)
  })

  it('invalid status → validation error on status', async () => {
    const dto = plainToInstance(UpdateStatusOperatorDto, { status: 'GARBAGE' })
    const errors = await validate(dto)
    expect(errors.some((e) => e.property === 'status')).toBe(true)
  })
})
