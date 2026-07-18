// Constant argon2id hash used to equalize verification timing when no operator
// matches the lookup (email or id). Without it, a miss skips the (slow) hash
// verify and returns measurably faster than a wrong password, enabling user
// enumeration by timing. This target never matches any real password.
// Shared by LoginUseCase and StepUpUseCase.
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$JEsFVXAuD0fPuOa76bb/9w$HTNJ4naPn/w0lcEhQUAQ68Jm+lWBtnSHrjvMZFFQcgs'
