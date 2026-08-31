import type { Prisma } from '@prisma/client'
import type { MockInstance } from 'vitest'

/**
 * Every model name the transaction client exposes. Keyed off the real client,
 * so a model that is renamed in the schema stops being a valid argument here.
 */
export type PrismaModel = {
  [K in keyof Prisma.TransactionClient]: Prisma.TransactionClient[K] extends object ? K : never
}[keyof Prisma.TransactionClient]

/**
 * A partial mock of one Prisma model delegate that the compiler still checks.
 *
 * The casts this replaces (`{ create: vi.fn() } as any`) erased exactly what
 * was worth keeping: rename a model or change a method's signature and the
 * spec sailed past unchanged. `as never` satisfies the lint rule and keeps the
 * blindness, which is why #395 recorded the count instead of forcing the rule.
 *
 * The model name is passed rather than inferred so the delegate type comes from
 * the real client rather than from the shape of the mock — inference from the
 * argument would just re-derive whatever was written.
 *
 * Unmocked methods throw instead of returning undefined, so a subject that
 * starts calling `findMany` fails with a sentence naming it rather than a
 * `Cannot read properties of undefined` three frames away.
 */
/**
 * The methods a mock may define for a model, keyed off the real delegate.
 *
 * Values are vitest mocks rather than the delegate's own signatures: Prisma
 * types `create` as `<T extends TenantCreateArgs>(args: SelectSubset<T, ...>)
 * => Prisma__TenantClient<...>`, a thenable with its own methods, and no
 * `vi.fn()` can satisfy that. What this does check is the model name and every
 * method name — which is what the erased casts were hiding.
 */
export type DelegateMock<TModel extends PrismaModel> = {
  [K in keyof Prisma.TransactionClient[TModel]]?: MockInstance
}

export function mockDelegate<TModel extends PrismaModel>(
  model: TModel,
  methods: DelegateMock<TModel>,
): Prisma.TransactionClient[TModel] {
  return new Proxy(methods as object, {
    get(target, property, receiver) {
      if (property in target) {
        return Reflect.get(target, property, receiver)
      }

      // Vitest and Node probe these while formatting output and while deciding
      // whether a value is thenable; throwing there would break the reporter.
      if (typeof property === 'symbol' || property === 'then' || property === 'toJSON') {
        return undefined
      }

      throw new Error(
        `prisma.${String(model)}.${String(property)}() was called but this mock does not define it`,
      )
    },
  }) as Prisma.TransactionClient[TModel]
}

/**
 * A transaction client carrying only the delegates a subject actually touches.
 * Typed as the real client, so an unknown delegate name is a compile error.
 */
export function mockTransactionClient(
  delegates: Partial<Prisma.TransactionClient>,
): Prisma.TransactionClient {
  return delegates as Prisma.TransactionClient
}

/**
 * A collaborator carrying only the members a subject actually touches.
 *
 * Same guarantee as {@link mockDelegate}: member names are checked against the
 * real type, and anything not provided throws when reached instead of being
 * `undefined`. Used for PrismaService and for repository ports alike.
 *
 * This is the point of the whole helper. `as any` erased the type; `as never`
 * and `as unknown as T` erase it just as thoroughly while satisfying the lint
 * rule — one escape hatch for another. Here the parameter is `Partial<T>`, so
 * a member that stops existing on T is a compile error.
 */
export function partialMock<TType extends object>(members: Partial<TType>): TType {
  return new Proxy(members as object, {
    get(target, property, receiver) {
      if (property in target) {
        return Reflect.get(target, property, receiver)
      }

      if (typeof property === 'symbol' || property === 'then' || property === 'toJSON') {
        return undefined
      }

      throw new Error(
        `prisma.${String(property)} was accessed but this mock does not define it`,
      )
    },
  }) as TType
}
