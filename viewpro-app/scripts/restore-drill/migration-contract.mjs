import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'

const PATH_METACHARACTERS = /[;&|`$<>\x00-\x1F\x7F]/

function fail(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

function isInside(root, candidate) {
  const path = relative(root, candidate)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function assertNoSymlinks(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    if (lstatSync(child).isSymbolicLink()) fail('migration_path_invalid')
    if (entry.isDirectory()) assertNoSymlinks(child)
  }
}

export function validateMigrationDirectory(candidate, { repositoryRoot }) {
  if (typeof candidate !== 'string' || typeof repositoryRoot !== 'string') fail('migration_path_invalid')
  if (PATH_METACHARACTERS.test(candidate) || candidate.split(/[\\/]+/).includes('..')) fail('migration_path_invalid')
  try {
    if (!lstatSync(candidate).isDirectory() || lstatSync(candidate).isSymbolicLink()) fail('migration_path_invalid')
    const root = realpathSync(repositoryRoot)
    const directory = realpathSync(candidate)
    if (!isInside(root, directory)) fail('migration_path_invalid')
    assertNoSymlinks(directory)
    return directory
  } catch {
    fail('migration_path_invalid')
  }
}

function tokenize(sql) {
  const tokens = []
  for (let index = 0; index < sql.length;) {
    if (/\s/.test(sql[index])) { index += 1; continue }
    if (sql.startsWith('--', index)) {
      index = sql.indexOf('\n', index + 2)
      if (index < 0) break
      continue
    }
    if (sql.startsWith('/*', index)) {
      let depth = 1
      index += 2
      while (index < sql.length && depth) {
        if (sql.startsWith('/*', index)) { depth += 1; index += 2 }
        else if (sql.startsWith('*/', index)) { depth -= 1; index += 2 }
        else index += 1
      }
      if (depth) fail('migration_sql_unsupported')
      continue
    }
    if (sql[index] === "'") {
      const escapeString = /[Ee]/.test(sql[index - 1]) && !/[A-Za-z0-9_$]/.test(sql[index - 2] ?? '')
      index += 1
      while (index < sql.length) {
        if (escapeString && sql[index] === '\\') index += 2
        else if (sql[index] === "'" && sql[index + 1] === "'") index += 2
        else if (sql[index++] === "'") break
      }
      continue
    }
    const dollar = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0]
    if (dollar) {
      const end = sql.indexOf(dollar, index + dollar.length)
      if (end < 0) fail('migration_sql_unsupported')
      index = end + dollar.length
      continue
    }
    if (sql[index] === '"') {
      let value = ''
      index += 1
      while (index < sql.length) {
        if (sql[index] === '"' && sql[index + 1] === '"') { value += '"'; index += 2 }
        else if (sql[index] === '"') { index += 1; break }
        else value += sql[index++]
      }
      tokens.push({ type: 'identifier', value })
      continue
    }
    const word = sql.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/)?.[0]
    if (word) {
      tokens.push({ type: 'word', value: word.toUpperCase() })
      index += word.length
      continue
    }
    if ('.;,'.includes(sql[index])) tokens.push({ type: sql[index], value: sql[index] })
    index += 1
  }
  return tokens
}

function keyword(token, value) {
  return token?.type === 'word' && token.value === value
}

function quoted(token) {
  return `"${token.value.replaceAll('"', '""')}"`
}

function identifier(token) {
  if (token?.type === 'identifier') return quoted(token)
  if (token?.type === 'word') return `"${token.value.toLowerCase()}"`
  fail('migration_sql_unsupported')
}

function tableName(tokens, index) {
  const first = identifier(tokens[index])
  if (tokens[index + 1]?.type !== '.') return { name: `"public".${first}`, next: index + 1 }
  const second = identifier(tokens[index + 2])
  return { name: `${first}.${second}`, next: index + 3 }
}

function skip(tokens, index, words) {
  return words.every((word, offset) => keyword(tokens[index + offset], word)) ? index + words.length : index
}

function foldSql(sql, tables) {
  const tokens = tokenize(sql)
  for (let index = 0; index < tokens.length; index += 1) {
    const routineDefinition = keyword(tokens[index], 'CREATE') && (
      keyword(tokens[index + 1], 'FUNCTION') || keyword(tokens[index + 1], 'PROCEDURE') ||
      keyword(tokens[index + 1], 'OR') && keyword(tokens[index + 2], 'REPLACE') && (keyword(tokens[index + 3], 'FUNCTION') || keyword(tokens[index + 3], 'PROCEDURE'))
    )
    if (routineDefinition) fail('migration_sql_unsupported')
    if ((index === 0 || tokens[index - 1]?.type === ';') && (keyword(tokens[index], 'DO') || keyword(tokens[index], 'EXECUTE') || keyword(tokens[index], 'CALL'))) fail('migration_sql_unsupported')
    if (keyword(tokens[index], 'CREATE') && keyword(tokens[index + 1], 'TABLE')) {
      let next = skip(tokens, index + 2, ['IF', 'NOT', 'EXISTS'])
      const table = tableName(tokens, next)
      tables.add(table.name)
      index = table.next - 1
      continue
    }
    if (keyword(tokens[index], 'DROP') && keyword(tokens[index + 1], 'TABLE')) {
      let next = skip(tokens, index + 2, ['IF', 'EXISTS'])
      while (next < tokens.length && tokens[next]?.type !== ';') {
        const table = tableName(tokens, next)
        tables.delete(table.name)
        next = table.next
        if (tokens[next]?.type !== ',') break
        next += 1
      }
      index = next - 1
      continue
    }
    if (keyword(tokens[index], 'ALTER') && keyword(tokens[index + 1], 'TABLE')) {
      const table = tableName(tokens, index + 2)
      if (keyword(tokens[table.next], 'RENAME') && keyword(tokens[table.next + 1], 'TO')) {
        tables.delete(table.name)
        tables.add(`${table.name.slice(0, table.name.lastIndexOf('.') + 1)}${identifier(tokens[table.next + 2])}`)
      } else if (keyword(tokens[table.next], 'SET') && keyword(tokens[table.next + 1], 'SCHEMA')) {
        tables.delete(table.name)
        tables.add(`${identifier(tokens[table.next + 2])}${table.name.slice(table.name.lastIndexOf('.'))}`)
      }
      index = table.next - 1
    }
  }
}

function sameTables(actual, expected) {
  return actual.length === expected.length && actual.every((table, index) => table === expected[index])
}

export function foldMigrations(candidate, { repositoryRoot, expectedTables } = {}) {
  const directory = validateMigrationDirectory(candidate, { repositoryRoot })
  const tables = new Set()
  for (const entry of readdirSync(directory, { withFileTypes: true }).filter((item) => item.isDirectory()).sort((a, b) => lexicalCompare(a.name, b.name))) {
    const migration = join(directory, entry.name, 'migration.sql')
    try { foldSql(readFileSync(migration, 'utf8'), tables) } catch (error) {
      if (['migration_path_invalid', 'migration_sql_unsupported'].includes(error?.code)) throw error
      fail('migration_path_invalid')
    }
  }
  const result = [...tables].sort()
  if (expectedTables !== undefined) {
    if (!Array.isArray(expectedTables) || !sameTables(result, [...expectedTables].sort())) fail('expected_tables_invalid')
  }
  return { tables: result }
}
