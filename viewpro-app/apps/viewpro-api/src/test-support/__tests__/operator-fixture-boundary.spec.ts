import { isBuiltin } from 'node:module'
import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const packageRoot = realpathSync(resolve(__dirname, '../../..'))
const repositoryRoot = realpathSync(resolve(packageRoot, '../../..'))
const forbiddenModules = new Set([
  'node:child_process',
  'child_process',
  'execa',
  'cross-spawn',
  'tinyexec',
  'shelljs',
  'zx',
])
const seedContractPath = 'src/database/__tests__/seed.spec.ts'
const forbiddenFiles = new Set(['prisma/seed.ts', 'test/global-setup.ts', seedContractPath])

type Edge = { specifier: string; nonliteral?: boolean }
type Step = { file: string; via?: string }
type Pending = { file: string; chain: Step[] }

function packagePath(file: string) {
  return relative(packageRoot, file).split(sep).join('/')
}

function isContainedBy(root: string, target: string) {
  const path = relative(root, target)
  return path === '' || path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

function isForbiddenModule(specifier: string) {
  return [...forbiddenModules].some((module) => specifier === module || specifier.startsWith(`${module}/`))
}

function failure(root: string, chain: Step[], reason: string): Error {
  const steps = chain.map(({ file, via }, index) =>
    index === 0 ? packagePath(file) : `--(${via})--> ${packagePath(file)}`,
  )
  return new Error(`Boundary violation for root ${packagePath(root)}: ${[...steps, reason].join(' ')}`)
}

function configuredRoots(): string[] {
  const config = readFileSync(resolve(packageRoot, 'vitest.config.ts'), 'utf8')
  const source = ts.createSourceFile('vitest.config.ts', config, ts.ScriptTarget.Latest)
  const includes: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'include' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const entry of node.initializer.elements) {
        if (!ts.isStringLiteral(entry)) throw new Error('Vitest include must use literal patterns')
        includes.push(entry.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (includes.length === 0) throw new Error('Vitest include patterns were not found')

  const roots: string[] = []
  for (const include of includes) {
    const match = /^(src|test)\/\*\*\/\*\.spec\.ts$/.exec(include)
    if (!match) throw new Error(`Unsupported Vitest spec include: ${include}`)
    const includeRoot = match[1]
    if (!includeRoot) throw new Error(`Unsupported Vitest spec include: ${include}`)
    const directory = resolve(packageRoot, includeRoot)
    const visitDirectory = (current: string): void => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const path = resolve(current, entry.name)
        if (entry.isDirectory()) visitDirectory(path)
        else if (entry.isFile() && path.endsWith('.spec.ts')) roots.push(path)
      }
    }
    visitDirectory(directory)
  }
  return roots.filter((root) => packagePath(root) !== seedContractPath).sort()
}

function effectiveOptions(): ts.CompilerOptions {
  const configPath = resolve(packageRoot, 'tsconfig.json')
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile)
  if (loaded.error) throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, packageRoot, undefined, configPath)
  const firstError = parsed.errors[0]
  if (firstError) throw new Error(ts.flattenDiagnosticMessageText(firstError.messageText, '\n'))
  if (parsed.options.moduleResolution !== ts.ModuleResolutionKind.Node16) {
    throw new Error('Boundary requires effective Node16 module resolution')
  }
  return parsed.options
}

function sourceEdges(file: string, cache: Map<string, Edge[]>): Edge[] {
  const cached = cache.get(file)
  if (cached) return cached
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const edges: Edge[] = []
  const add = (node: ts.Expression) => {
    if (ts.isStringLiteralLike(node)) edges.push({ specifier: node.text })
    else edges.push({ specifier: node.getText(source), nonliteral: true })
  }
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) add(node.moduleSpecifier)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const argument = node.moduleReference.expression
      if (argument) add(argument)
      else edges.push({ specifier: node.moduleReference.getText(source), nonliteral: true })
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0]
      if (argument) add(argument)
      else edges.push({ specifier: node.expression.getText(source), nonliteral: true })
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const argument = node.arguments.length === 1 ? node.arguments[0] : undefined
      if (argument) add(argument)
      else edges.push({ specifier: node.expression.getText(source), nonliteral: true })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  cache.set(file, edges)
  return edges
}

function checkOrdinarySpecBoundary() {
  const options = effectiveOptions()
  const cache = new Map<string, Edge[]>()
  const resolutionCache = ts.createModuleResolutionCache(packageRoot, (file) => file, options)
  let traversedWorkspaceDependency = false
  for (const root of configuredRoots()) {
    const pending: Pending[] = [{ file: root, chain: [{ file: root }] }]
    const visited = new Set<string>()
    while (pending.length > 0) {
      const current = pending.pop()!
      if (visited.has(current.file)) continue
      visited.add(current.file)
      for (const edge of sourceEdges(current.file, cache)) {
        if (edge.nonliteral) throw failure(root, current.chain, `--(${edge.specifier})--> nonliteral loader`)
        if (isForbiddenModule(edge.specifier)) throw failure(root, current.chain, `--(${edge.specifier})--> forbidden module`)
        if (isBuiltin(edge.specifier)) continue
        const resolved = ts.resolveModuleName(edge.specifier, current.file, options, ts.sys, resolutionCache).resolvedModule
        if (!resolved) throw failure(root, current.chain, `--(${edge.specifier})--> unresolved edge`)
        const target = realpathSync(resolved.resolvedFileName)
        const repositoryLocal = isContainedBy(repositoryRoot, target)
        const dependencyInstall = relative(repositoryRoot, target).split(sep).includes('node_modules')
        if (resolved.isExternalLibraryImport && (!repositoryLocal || dependencyInstall)) continue
        if (!repositoryLocal) throw failure(root, current.chain, `--(${edge.specifier})--> escaping local edge`)
        if (resolved.isExternalLibraryImport) traversedWorkspaceDependency = true
        if (forbiddenFiles.has(packagePath(target))) throw failure(root, current.chain, `--(${edge.specifier})--> forbidden ${packagePath(target)}`)
        pending.push({ file: target, chain: [...current.chain, { file: target, via: edge.specifier }] })
      }
    }
  }
  if (!traversedWorkspaceDependency) throw new Error('Boundary did not traverse any workspace dependency')
}

describe('ordinary platform-api spec dependency boundary', () => {
  it('checks every ordinary spec closure', () => {
    expect(checkOrdinarySpecBoundary()).toBeUndefined()
  })
})
