import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const directory = 'viewpro-app/scripts/production-cutover';

// Exact tracked identity of every merged contract file this qualification composes.
const blobs = Object.freeze({
  'candidate.v1.json': 'fa4d1bbbec154380a6c188937d7880299672a875',
  'final-tree.v1.json': 'f6f55cf0ae989fb56b8afd19e4bff5d7d5f637c3',
  'remediation-manifest.v1.json': 'd1a708a4177651e7cb36f11b2c3a03348cda103e',
  'release-manifest.v1.schema.json': '3e913e35a14e316094bd8c28deef0a1159a89889',
  'release-manifest.v1.template.json': 'a9b7af38a34c2c78ceb4d92f9beaa47845c581dd',
  'lineage-contract.mjs': 'e8e866e1f4225107f53df979f6be66c7c0424a68',
  'tree-byte-contract.mjs': 'a47bee91eb68d277edbf5aab95fc60d4a3ff7c05',
  'release-contract.mjs': '9d9b84f16df365034e1857735e52d9b629423624',
});

const gitExecutable = '/usr/bin/git';
const maxBoundMs = 600_000;
const defaultOutputLimit = 1 << 20;
const outputCeiling = 1 << 26;
// How long to keep confirming a group is gone before giving up and reporting residue.
// The window always outlasts the escalation ladder, so SIGKILL is never pre-empted.
const groupConfirmMs = 5_000;

// This module signals process groups directly, so it is POSIX-only by construction;
// `gitExecutable` and `PATH` below already assume it.
const environment = Object.freeze({
  PATH: '/usr/bin:/bin',
  HOME: '/tmp',
  LANG: 'C',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_ATTR_NOSYSTEM: '1',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_ALTERNATE_OBJECT_DIRECTORIES: '',
  GIT_EXTERNAL_DIFF: '',
  GIT_TERMINAL_PROMPT: '0',
});

// Ambient or repository-local configuration must not be able to change observed output.
const hardening = Object.freeze([
  '--no-pager',
  '--no-replace-objects',
  '-c', 'core.hooksPath=/dev/null',
  '-c', 'core.attributesFile=/dev/null',
  '-c', 'core.useReplaceRefs=false',
  '-c', 'core.fsmonitor=',
  '-c', 'diff.external=',
]);

// Every operation reads refs or the committed tree. Worktree bytes are never hashed by
// Git, because `hash-object` applies attribute-selected clean filters that an untracked
// `.gitattributes` can introduce — that is a command-execution path, so it is not used.
const operations = Object.freeze({
  root: Object.freeze(['rev-parse', '--show-toplevel']),
  head: Object.freeze(['rev-parse', 'HEAD']),
  tree: Object.freeze(['rev-parse', 'HEAD^{tree}']),
  detached: Object.freeze(['symbolic-ref', '-q', 'HEAD']),
  replaces: Object.freeze(['for-each-ref', 'refs/replace', '--format=%(refname)']),
  alternates: Object.freeze(['rev-parse', '--git-path', 'objects/info/alternates']),
});

const trackedOperation = /^tracked:(?<file>.+)$/;

// Resolves an own string to a fixed argument vector, or null. Callers never supply argv.
const selectGitOperation = (operation) => {
  // Guard the type before any lookup or match, so no caller value is ever coerced.
  if (typeof operation !== 'string') return null;
  // `hasOwn`, never `in`: prototype keys such as `toString` must not select an operation.
  if (Object.hasOwn(operations, operation)) return operations[operation];
  const match = trackedOperation.exec(operation);
  if (match === null || !Object.hasOwn(blobs, match.groups.file)) return null;
  return ['ls-tree', 'HEAD', '--', `${directory}/${match.groups.file}`];
};

const bounded = (value, limit) => Number.isSafeInteger(value) && value > 0 && value <= limit;

// Git's own blob identity, computed here so no filter or attribute can influence it.
export const blobIdentity = (bytes) =>
  createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

// The seam observes a live child for lifecycle tests. It receives no operation and no
// argument vector, so it can never influence which command runs.
let fixedGitObserver;
export const setFixedGitObserverForTest = (observer) => {
  fixedGitObserver = observer;
};

const rejection = (error) =>
  Promise.resolve({
    ok: false,
    code: null,
    signal: null,
    timedOut: false,
    overflow: false,
    residue: false,
    output: '',
    stderr: '',
    error,
  });

export function runFixedGit(root, operation, options = {}) {
  const args = selectGitOperation(operation);
  if (typeof root !== 'string' || args === null) return rejection('invalid-operation');

  const settings = options ?? {};
  const timeout = settings.timeout ?? 10_000;
  const killAfter = settings.killAfter ?? 2_000;
  const maxOutput = settings.maxOutput ?? defaultOutputLimit;
  const badBounds =
    !bounded(timeout, maxBoundMs) ||
    !bounded(killAfter, maxBoundMs) ||
    !bounded(maxOutput, outputCeiling);
  if (badBounds) return rejection('invalid-bounds');

  const confirmWindow = killAfter + groupConfirmMs;

  return new Promise((settle) => {
    let child = null;
    let timer = null;
    let killer = null;
    let poll = null;
    let deadline = null;
    let abandon = null;
    let output = '';
    let stderr = '';
    let overflow = false;
    let timedOut = false;
    let residue = false;
    let error = '';
    let settled = false;
    let confirming = false;
    let reaped = false;

    const groupAlive = () => {
      if (!(child?.pid > 0)) return false;
      try {
        process.kill(-child.pid, 0);
        return true;
      } catch {
        return false;
      }
    };

    // Never signals after the child is reaped, because the PGID may then be recycled,
    // and never after settlement.
    const signalGroup = (signal) => {
      if (settled || reaped || !groupAlive()) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        // Raced to empty, or unsignalable; the confirmation poll decides the outcome.
      }
    };

    const escalate = () => {
      if (settled) return;
      signalGroup('SIGTERM');
      clearTimeout(killer);
      killer = setTimeout(() => signalGroup('SIGKILL'), killAfter);
    };

    const append = (chunk) => {
      if (overflow) return;
      const room = maxOutput - output.length;
      if (chunk.length <= room) {
        output += chunk.toString('utf8');
        return;
      }
      output += chunk.toString('utf8', 0, room);
      overflow = true;
      escalate();
    };

    const collectError = (chunk) => {
      if (stderr.length < maxOutput) stderr += chunk.toString('utf8');
    };

    // Settles unconditionally. Its precondition is that the group is confirmed gone,
    // no child was ever created, or the call has explicitly given up with `residue`.
    const settleNow = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killer);
      clearTimeout(deadline);
      clearTimeout(abandon);
      clearInterval(poll);
      child?.stdout?.off('data', append);
      child?.stderr?.off('data', collectError);
      child?.stdout?.off('error', onError);
      child?.stderr?.off('error', onError);
      child?.off('error', onError);
      child?.off('close', onClose);
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      settle({
        ok: code === 0 && signal == null && !timedOut && !overflow && !residue && error === '',
        code: code ?? null,
        signal: signal ?? null,
        timedOut,
        overflow,
        residue,
        output,
        stderr,
        error,
      });
    };

    // The settle point for a live child; the spawn-failure path settles directly. This
    // never settles while the process group is still alive: it escalates, then polls
    // until the group is gone or the window expires and residue is reported.
    const settleWhenGroupGone = (code, signal) => {
      if (settled) return;
      if (!groupAlive()) {
        settleNow(code, signal);
        return;
      }
      if (confirming) return;
      confirming = true;
      escalate();
      poll = setInterval(() => {
        if (!groupAlive()) settleNow(code, signal);
      }, 10);
      deadline = setTimeout(() => {
        residue = true;
        settleNow(code, signal);
      }, confirmWindow);
    };

    function onError(caught) {
      if (error === '') error = String(caught);
      settleWhenGroupGone(null, null);
    }

    function onClose(code, signal) {
      settleWhenGroupGone(code, signal);
    }

    try {
      child = spawn(gitExecutable, [...hardening, ...args], {
        cwd: root,
        env: environment,
        shell: false,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (caught) {
      error = String(caught);
      settleNow(null, null);
      return;
    }

    child.stdout.on('data', append);
    child.stderr.on('data', collectError);
    // A pipe fault would otherwise be an unhandled 'error' that kills the process
    // without ever settling this call.
    child.stdout.once('error', onError);
    child.stderr.once('error', onError);
    child.once('error', onError);
    child.once('exit', () => {
      reaped = true;
    });
    child.once('close', onClose);

    // Armed before the seam runs, so an observer exception still has a live backstop.
    timer = setTimeout(() => {
      timedOut = true;
      escalate();
      // A group that is signalled but never dies reports neither 'close' nor 'error',
      // so nothing else would ever settle this call. Give up rather than wait forever.
      abandon = setTimeout(() => {
        residue = true;
        settleNow(null, null);
      }, confirmWindow);
    }, timeout);

    try {
      fixedGitObserver?.(child);
    } catch (caught) {
      // Never settle here: escalate and let the close path confirm the group is gone.
      error = String(caught);
      escalate();
    }
  });
}

// --- Candidate qualification -------------------------------------------------------

const receipt = 'openspec/changes/neon-clean-production-cutover/apply-progress.md';
const prefix = Object.freeze(['main@868dc70', '#331', '#333', '#334', '#335', '#336']);
const exclusions = Object.freeze(['#338', '#341', '#344', '#351', '#314']);
const units = Object.freeze(['WU1', 'WU2', 'WU3', 'WU4', 'WU5', 'WU6', 'WU7']);
const reviewedMerges = Object.freeze([
  'faf870ab0a29e6a271b7391776fc2f9cf25c12ac',
  'd53a57c04f34efd20fc825aff5c03115c9c6c99f',
]);

// WU1 and WU2 carry their real reviewed-merge identities. WU3-WU7 are not merged yet, so
// each stands in as its own digit repeated 40 times: decimal digits are valid lowercase
// hex, so these satisfy the contracts' /^[a-f0-9]{40}$/ and stay distinct while
// `units.length` is at most 9.
const identities = Object.freeze(
  units.map((_, index) => reviewedMerges[index] ?? String(index + 1).repeat(40)),
);

const patches = units.map((workUnit, index) => ({ workUnit, identity: identities[index] }));
const final = [...prefix, ...identities];

const expectedLineage = {
  prefix: [...prefix],
  exclusions: [...exclusions],
  patches,
  final,
  closure: [],
};

const expectedRelease = {
  schemaVersion: 1,
  kind: 'production-cutover-release-contract',
  prefix: [...prefix],
  workUnits: patches,
  final,
  closure: [],
  remediation: {
    WU1: { reviewedDevelopMerge: reviewedMerges[0], implementationReceipt: receipt },
    WU2: { reviewedDevelopMerge: reviewedMerges[1], implementationReceipt: receipt },
  },
};

// Every pinned contract file is a regular non-executable blob.
const expectedTreeLine = (identity, file) => `100644 blob ${identity}\t${directory}/${file}`;

const stdoutOf = (result) => result.output.trimEnd();
const denied = (reason, detail = '') => ({ ok: false, authority: false, reason, detail });

// The audited contract files, exported so a test can pin the exact set: deriving a
// count from `blobs` alone would let an entry be dropped from both sides unnoticed.
export const pinnedContractFiles = Object.freeze(Object.keys(blobs));

// Exactly the Git invocations one successful qualification makes, so a test can pin it.
export const expectedGitSpawns = Object.keys(operations).length + pinnedContractFiles.length;

export const denialReasons = Object.freeze([
  'root-mismatch',
  'not-detached',
  'commit-mismatch',
  'tree-mismatch',
  'replacement-refs',
  'object-alternates',
  'probe-failed',
  'alternates-unreadable',
  'tracked-blob-unreadable',
  'tracked-blob-drift',
  'worktree-blob-drift',
  'lineage-rejected',
  'tree-byte-rejected',
  'release-rejected',
  'release-authority-granted',
  'audit-failed',
]);

export async function qualifyCandidate({ root, commit, tree } = {}) {
  try {
    const canonical = await realpath(root);
    // Keyed, not positional: reordering `operations` must not silently rewire the audit.
    const names = Object.keys(operations);
    const results = await Promise.all(names.map((name) => runFixedGit(canonical, name)));
    const probe = Object.fromEntries(names.map((name, index) => [name, results[index]]));
    const { root: shown, head, tree: actualTree, detached: branch, replaces, alternates } = probe;

    // Every probe fails closed as a set. `detached` is the sole exemption because its
    // non-zero exit IS its answer; for the rest, a probe that could not run must deny
    // qualification rather than be misread as an absent condition.
    for (const name of names) {
      if (name !== 'detached' && !probe[name].ok) return denied('probe-failed', name);
    }
    if (stdoutOf(shown) !== canonical) return denied('root-mismatch');
    // `symbolic-ref -q HEAD` exits 1 exactly when HEAD names no branch, i.e. is detached.
    if (branch.code !== 1) return denied('not-detached');
    if (stdoutOf(head) !== commit) return denied('commit-mismatch');
    if (stdoutOf(actualTree) !== tree) return denied('tree-mismatch');
    if (stdoutOf(replaces) !== '') return denied('replacement-refs');

    const alternatesPath = resolve(canonical, stdoutOf(alternates));
    // Only a genuinely absent file is the clean case; any other read fault fails closed.
    const configuredAlternates = await readFile(alternatesPath, 'utf8').catch((caught) =>
      caught?.code === 'ENOENT' ? '' : null,
    );
    if (configuredAlternates === null) return denied('alternates-unreadable');
    if (configuredAlternates.trim() !== '') return denied('object-alternates');

    for (const [file, identity] of Object.entries(blobs)) {
      const tracked = await runFixedGit(canonical, `tracked:${file}`);
      if (!tracked.ok) return denied('tracked-blob-unreadable', file);
      if (stdoutOf(tracked) !== expectedTreeLine(identity, file)) {
        return denied('tracked-blob-drift', file);
      }
      const bytes = await readFile(resolve(canonical, directory, file));
      if (blobIdentity(bytes) !== identity) return denied('worktree-blob-drift', file);
    }

    const load = (file) => import(pathToFileURL(resolve(canonical, directory, file)).href);
    const [lineage, treeByte, release] = await Promise.all([
      load('lineage-contract.mjs'),
      load('tree-byte-contract.mjs'),
      load('release-contract.mjs'),
    ]);
    const policy = await readFile(resolve(canonical, directory, 'final-tree.v1.json'));

    if (!lineage.validateLineage(expectedLineage)) return denied('lineage-rejected');
    if (!treeByte.validateTreeBytePolicy(new Uint8Array(policy))) return denied('tree-byte-rejected');
    if (!release.validateReleaseRecord(expectedRelease)) return denied('release-rejected');
    if (release.releaseAuthority()) return denied('release-authority-granted');

    return { ok: true, authority: false, reason: '', detail: '' };
  } catch (caught) {
    return denied('audit-failed', String(caught));
  }
}
