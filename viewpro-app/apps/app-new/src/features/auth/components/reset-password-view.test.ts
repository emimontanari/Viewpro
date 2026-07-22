import { describe, expect, it } from 'vitest';
import { resetPasswordSchema } from './reset-password-view';

describe('resetPasswordSchema', () => {
  it('accepts matching passwords of at least 8 characters', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'newpass123',
      confirmPassword: 'newpass123'
    });
    expect(result.success).toBe(true);
  });

  it('rejects when the passwords do not match', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'newpass123',
      confirmPassword: 'different1'
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword']);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'short',
      confirmPassword: 'short'
    });
    expect(result.success).toBe(false);
  });
});
