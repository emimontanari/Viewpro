#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

const directory = dirname(process.argv[1])
const input = readFileSync(0, 'utf8')
const argv = process.argv.slice(2)
const executableSql = input
  .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, ' ')
  .replace(/'(?:''|[^'])*'/g, ' ')
  .replace(/"(?:""|[^"])*"/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ')
  .replace(/\s+/g, ' ')
const ddlAttempt = /\b(?:CREATE\s+(?:(?:TEMP(?:ORARY)?|UNLOGGED)\s+)?TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE(?:\s+TABLE)?|SELECT\b[\s\S]*\bINTO\b)/i.test(executableSql)
const startupAttempt = existsSync(join(directory, 'startup-output.txt')) && !argv.includes('-X')
const catalogSql = existsSync(join(directory, 'expected-catalog.sql')) ? readFileSync(join(directory, 'expected-catalog.sql'), 'utf8') : undefined
const ledgerSql = existsSync(join(directory, 'expected-ledger.sql')) ? readFileSync(join(directory, 'expected-ledger.sql'), 'utf8') : undefined
const queryKind = input === catalogSql ? 'catalog' : input === ledgerSql ? 'ledger' : undefined
const callsPath = join(directory, 'calls.jsonl')
const invocation = existsSync(callsPath) ? readFileSync(callsPath, 'utf8').trim().split('\n').filter(Boolean).length + 1 : 1
const control = (name) => { const targeted = join(directory, `${name}-${queryKind}-${invocation}.txt`); return existsSync(targeted) ? targeted : join(directory, `${name}.txt`) }
appendFileSync(callsPath, `${JSON.stringify({ argv, env: Object.fromEntries(Object.entries(process.env).sort().map(([key, value]) => [key, createHash('sha256').update(value).digest('hex')])), input, ddlAttempt, startupAttempt })}\n`)
if (startupAttempt) process.stdout.write(readFileSync(join(directory, 'startup-output.txt'), 'utf8'))
if (ddlAttempt && existsSync(join(directory, 'reject-ddl.txt'))) process.exit(73)
if (!queryKind && existsSync(join(directory, 'exact-required.txt'))) process.exit(76)
if (existsSync(control('signal'))) process.kill(process.pid, readFileSync(control('signal'), 'utf8').trim() || 'SIGTERM')
if (existsSync(control('hang'))) { writeFileSync(join(directory, 'pid.txt'), String(process.pid)); process.on('SIGTERM', () => writeFileSync(join(directory, 'term.txt'), 'ignored')); setInterval(() => {}, 1_000) }
if (existsSync(join(directory, 'stderr.txt'))) process.stderr.write(readFileSync(join(directory, 'stderr.txt'), 'utf8'))
const status = existsSync(control('status')) ? Number(readFileSync(control('status'), 'utf8')) : 0
if (status) process.exit(status)
process.stdout.write(readFileSync(join(directory, queryKind === 'ledger' ? 'ledger.tsv' : 'catalog.tsv'), 'utf8'))
