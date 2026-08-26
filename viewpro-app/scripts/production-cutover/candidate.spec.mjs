import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  blobIdentity,
  expectedGitSpawns,
  pinnedContractFiles,
  qualifyCandidate,
  runFixedGit,
  setFixedGitObserverForTest,
} from './candidate.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const git = (cwd, args) =>
  execFileSync('/usr/bin/git', args, { cwd, encoding: 'utf8' }).trim();

const head = git(repoRoot, ['rev-parse', 'HEAD']);
const headTree = git(repoRoot, ['rev-parse', 'HEAD^{tree}']);

// The candidate's own HEAD state must never be assumed: `actions/checkout` leaves HEAD
// detached for pull_request runs and attached for push runs, so every test builds the
// exact checkout shape it needs and removes it afterwards.
let fixtureCount = 0;
const withWorktree = async (commit, detach, body) => {
  const parent = mkdtempSync(join(tmpdir(), 'qualify-'));
  const checkout = join(parent, 'candidate');
  fixtureCount += 1;
  const branch = `qualify-fixture-${process.pid}-${fixtureCount}`;
  const add = detach
    ? ['worktree', 'add', '--detach', checkout, commit]
    : ['worktree', 'add', '-b', branch, checkout, commit];
  git(repoRoot, add);
  try {
    return await body(checkout);
  } finally {
    // Each cleanup is independent so one failure cannot strand the next, and none of
    // them may replace the body's assertion error.
    for (const step of [
      () => git(repoRoot, ['worktree', 'remove', '--force', checkout]),
      () => git(repoRoot, ['worktree', 'prune']),
      () => (detach ? undefined : git(repoRoot, ['branch', '-D', branch])),
      () => rmSync(parent, { recursive: true, force: true }),
    ]) {
      try {
        step();
      } catch {
        // Best effort; the remaining cleanups still run.
      }
    }
  }
};

const groupGone = (pid) => {
  if (!(pid > 0)) return true;
  try {
    process.kill(-pid, 0);
    return false;
  } catch {
    return true;
  }
};

// pid 0 would signal this process's own group, so a run that never reached the observer
// must be a no-op rather than killing the test runner.
const reap = (pid) => {
  if (!(pid > 0)) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone, which is the passing case.
  }
};

test('rejects hostile operation values before spawning', async (t) => {
  let spawned = 0;
  t.after(() => setFixedGitObserverForTest());
  setFixedGitObserverForTest(() => {
    spawned += 1;
  });
  const hostile = [
    ['root'],
    Symbol('root'),
    Object.assign(Object.create(null), { toString: () => 'root' }),
    { toString: () => 'root' },
    { [Symbol.toPrimitive]: () => 'root' },
    'arbitrary-command',
    // Prototype keys: these select an operation if `hasOwn` is ever weakened to `in`.
    'toString',
    'constructor',
    '__proto__',
    'hasOwnProperty',
    'tracked:__proto__',
    'tracked:constructor',
    'tracked:../../../etc/passwd',
  ];
  for (const operation of hostile) {
    const result = await runFixedGit(repoRoot, operation);
    assert.equal(result.ok, false, `${String(operation)} must not select an operation`);
    assert.equal(result.error, 'invalid-operation', `${String(operation)} must fail closed`);
  }
  assert.equal(spawned, 0);
});

test('rejects a non-string root and a hostile options value', async () => {
  for (const root of [null, undefined, 42, ['/tmp'], Symbol('/tmp')]) {
    const result = await runFixedGit(root, 'root');
    assert.equal(result.ok, false, `${String(root)} must be rejected`);
    assert.equal(result.error, 'invalid-operation');
  }
  // A null options value must settle, never throw, like every other rejection path.
  const nulled = await runFixedGit(repoRoot, 'root', null);
  assert.equal(nulled.ok, true);
});

test('accepts boundary bounds and rejects everything outside them', async () => {
  const rejected = [
    { timeout: 0 },
    { timeout: -1 },
    { timeout: 1.5 },
    { timeout: Number.NaN },
    { timeout: Number.POSITIVE_INFINITY },
    { timeout: 600_001 },
    { timeout: '100' },
    { maxOutput: 0 },
    { maxOutput: -1 },
    { maxOutput: (1 << 26) + 1 },
    { killAfter: 0 },
    { killAfter: -1 },
    { killAfter: 1.5 },
    { killAfter: 600_001 },
    { maxOutput: Number.NaN },
    { maxOutput: 1.5 },
  ];
  for (const option of rejected) {
    const result = await runFixedGit(repoRoot, 'root', option);
    assert.equal(result.ok, false, `${JSON.stringify(option)} must be rejected`);
    assert.equal(result.error, 'invalid-bounds', `${JSON.stringify(option)} is a bounds fault`);
  }
  const accepted = await runFixedGit(repoRoot, 'root', {
    timeout: 600_000,
    killAfter: 600_000,
    maxOutput: 1 << 26,
  });
  assert.equal(accepted.ok, true, accepted.error);
});

test('resolves the canonical root through the closed table', async () => {
  const result = await runFixedGit(repoRoot, 'root');
  assert.equal(result.ok, true, result.error);
  assert.equal(result.code, 0);
  assert.equal(result.residue, false);
  assert.equal(result.output.trim(), git(repoRoot, ['rev-parse', '--show-toplevel']));
});

test('reports a spawn failure distinctly', async () => {
  const result = await runFixedGit(join(repoRoot, 'no-such-directory'), 'root');
  assert.equal(result.ok, false);
  assert.equal(result.code, null);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.overflow, false);
  assert.notEqual(result.error, '');
});

test('reports a real non-zero exit distinctly', async () => {
  await withWorktree(head, true, async (checkout) => {
    const result = await runFixedGit(checkout, 'detached');
    assert.equal(result.ok, false);
    assert.equal(result.code, 1);
    assert.equal(result.signal, null);
    assert.equal(result.timedOut, false);
    assert.equal(result.residue, false);
  });
});

test('truncates output at a positive finite limit', async () => {
  const result = await runFixedGit(repoRoot, 'root', { maxOutput: 8 });
  assert.equal(result.ok, false);
  assert.equal(result.overflow, true);
  assert.equal(result.output.length, 8);
});

test('escalates a timeout and confirms the group is gone', async (t) => {
  let group = 0;
  t.after(() => setFixedGitObserverForTest());
  setFixedGitObserverForTest((child) => {
    group = child.pid;
    process.kill(-child.pid, 'SIGSTOP');
  });
  const timersBefore = process.getActiveResourcesInfo().filter((kind) => kind === 'Timeout').length;
  const result = await runFixedGit(repoRoot, 'root', { timeout: 60, killAfter: 60 });
  const gone = groupGone(group);
  const timersAfter = process.getActiveResourcesInfo().filter((kind) => kind === 'Timeout').length;
  reap(group);
  assert.ok(group > 0, 'the observer must have seen a live child');
  assert.equal(timersAfter, timersBefore, 'no timer may outlive the call');
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  // A stopped process still takes the default terminate action, so Git dies on SIGTERM and
  // SIGKILL stays the backstop for anything that catches it. Either proves escalation ran.
  assert.ok(['SIGTERM', 'SIGKILL'].includes(result.signal), `escalated, saw ${result.signal}`);
  assert.equal(gone, true, 'the process group must be gone before the call settles');
  assert.equal(result.residue, false);
});

test('terminates a stopped group when the observer throws', async (t) => {
  let group = 0;
  t.after(() => setFixedGitObserverForTest());
  setFixedGitObserverForTest((child) => {
    group = child.pid;
    process.kill(-child.pid, 'SIGSTOP');
    throw new Error('observer failure');
  });
  const started = Date.now();
  const result = await runFixedGit(repoRoot, 'root', { timeout: 60, killAfter: 60 });
  const gone = groupGone(group);
  reap(group);
  assert.ok(group > 0, 'the observer must have seen a live child');
  assert.equal(result.ok, false);
  assert.match(result.error, /observer failure/);
  assert.equal(gone, true, 'the process group must be gone before the call settles');
  // The residue deadline bounds this path even when escalation cannot reap the group.
  assert.ok(Date.now() - started < 1_000, 'settlement must be prompt, not deadline-driven');
});

test('never settles while the process group is still alive', async (t) => {
  let group = 0;
  t.after(() => setFixedGitObserverForTest());
  setFixedGitObserverForTest((child) => {
    group = child.pid;
    process.kill(-child.pid, 'SIGSTOP');
    // A synthetic proxy: this module signals with `process.kill` and swallows EPERM, so
    // it never emits 'error' on a live child itself. The invariant being pinned is that
    // NO route may settle while the group is alive. The timeout is deliberately long, so
    // only terminating settlement can end this call promptly.
    child.emit('error', new Error('kill EPERM'));
  });
  const started = Date.now();
  const result = await runFixedGit(repoRoot, 'root', { timeout: 30_000, killAfter: 60 });
  const gone = groupGone(group);
  reap(group);
  assert.ok(group > 0, 'the observer must have seen a live child');
  assert.equal(result.ok, false);
  assert.match(result.error, /EPERM/);
  assert.equal(gone, true, 'settlement must confirm the group is gone');
  assert.ok(Date.now() - started < 10_000, 'settlement must be bounded');
});

test('gives up and reports residue when the child never reports', async (t) => {
  let group = 0;
  t.after(() => setFixedGitObserverForTest());
  setFixedGitObserverForTest((child) => {
    group = child.pid;
    process.kill(-child.pid, 'SIGSTOP');
    // Simulates a group that is signalled but never reports close or exit, which is how
    // an unkillable or uninterruptible member looks from here. Without an absolute
    // backstop nothing would ever settle this call.
    child.removeAllListeners('close');
    child.removeAllListeners('exit');
  });
  const started = Date.now();
  const result = await runFixedGit(repoRoot, 'root', { timeout: 60, killAfter: 60 });
  reap(group);
  assert.equal(result.timedOut, true);
  assert.equal(result.residue, true, 'the call must give up rather than wait forever');
  assert.equal(result.ok, false);
  assert.ok(Date.now() - started < 20_000, 'the backstop must bound the call');
});

test('keeps Git stderr out of the compared output', async () => {
  const outside = mkdtempSync(join(tmpdir(), 'not-a-repo-'));
  try {
    const result = await runFixedGit(outside, 'root');
    assert.equal(result.ok, false);
    // Merged streams would corrupt every exact comparison the audit makes.
    assert.equal(result.output, '', 'stdout must stay clean for exact comparisons');
    assert.match(result.stderr, /not a git repository/i);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test('fails closed when the candidate borrows objects through alternates', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'qualify-alt-'));
  const clone = join(parent, 'candidate');
  try {
    // `--shared` writes objects/info/alternates, which is exactly the object-substitution
    // surface the audit must reject. A standalone clone is used rather than a linked
    // worktree, because a worktree reads the outer repository's object configuration.
    git(repoRoot, ['clone', '--shared', '--quiet', repoRoot, clone]);
    git(clone, ['checkout', '--quiet', '--detach', head]);
    const result = await qualifyCandidate({ root: clone, commit: head, tree: headTree });
    assert.equal(result.reason, 'object-alternates');
    assert.equal(result.authority, false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('fails closed when a probe cannot run at all', async () => {
  const outside = mkdtempSync(join(tmpdir(), 'not-a-repo-'));
  try {
    const result = await qualifyCandidate({ root: outside, commit: head, tree: headTree });
    // Never a mismatch reason: a probe that could not run must not be read as an answer.
    assert.equal(result.reason, 'probe-failed');
    assert.equal(result.authority, false);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test('fails closed when aimed at a subdirectory instead of the repository root', async () => {
  await withWorktree(head, true, async (checkout) => {
    const result = await qualifyCandidate({
      root: join(checkout, 'viewpro-app'),
      commit: head,
      tree: headTree,
    });
    assert.equal(result.reason, 'root-mismatch');
    assert.equal(result.authority, false);
  });
});

test('ignores a poisoned ambient Git environment', async (t) => {
  const poisoned = {
    GIT_DIR: '/nonexistent-git-dir',
    GIT_WORK_TREE: '/nonexistent-work-tree',
    GIT_ALTERNATE_OBJECT_DIRECTORIES: '/nonexistent-alternates',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath',
    GIT_CONFIG_VALUE_0: '/nonexistent-hooks',
  };
  const restore = Object.fromEntries(Object.keys(poisoned).map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(restore)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, poisoned);

  // Unhardened Git genuinely breaks under this environment, so the assertion below only
  // holds because the module replaces the environment instead of inheriting it.
  assert.throws(() => git(repoRoot, ['rev-parse', 'HEAD']), /not a git repository|nonexistent/i);
  const result = await runFixedGit(repoRoot, 'head');
  assert.equal(result.ok, true, result.error);
  assert.equal(result.output.trim(), head);
});

test('detects worktree tampering hidden behind a Git clean filter', async () => {
  await withWorktree(head, true, async (checkout) => {
    const target = join(checkout, 'viewpro-app/scripts/production-cutover/lineage-contract.mjs');
    const pristine = git(checkout, ['rev-parse', 'HEAD:viewpro-app/scripts/production-cutover/lineage-contract.mjs']);
    // A clean filter makes `git hash-object` report the pinned identity for tampered
    // bytes, so qualification must derive blob identity itself rather than ask Git.
    writeFileSync(join(checkout, '.gitattributes'), 'lineage-contract.mjs filter=pin\n');
    writeFileSync(target, 'export function validateLineage() { return true; }\n');

    // Passed with `-c`, never `git config`: a linked worktree shares the main
    // repository's config file, so persisting a filter would install a content
    // substitution in the real repository and outlive the fixture.
    const spoofed = git(checkout, [
      '-c', `filter.pin.clean=git cat-file blob ${pristine}`,
      'hash-object', 'viewpro-app/scripts/production-cutover/lineage-contract.mjs',
    ]);
    assert.equal(spoofed, pristine, 'the filter must actually spoof git hash-object');

    const result = await qualifyCandidate({ root: checkout, commit: head, tree: headTree });
    assert.equal(result.reason, 'worktree-blob-drift');
    assert.equal(result.detail, 'lineage-contract.mjs');
    assert.equal(result.ok, false);
  });
});

test('fails closed on an attached HEAD', async () => {
  await withWorktree(head, false, async (checkout) => {
    const result = await qualifyCandidate({ root: checkout, commit: head, tree: headTree });
    assert.equal(result.reason, 'not-detached');
    assert.equal(result.ok, false);
    assert.equal(result.authority, false);
  });
});

test('qualifies a detached candidate from real closed audits', async (t) => {
  let spawned = 0;
  t.after(() => setFixedGitObserverForTest());
  setFixedGitObserverForTest(() => {
    spawned += 1;
  });
  const result = await withWorktree(head, true, (checkout) =>
    qualifyCandidate({ root: checkout, commit: head, tree: headTree }));
  assert.equal(result.reason, '');
  assert.equal(result.ok, true);
  assert.equal(result.authority, false);
  // Pinned exactly against a literal and against the audited file set: deriving both
  // sides from `blobs` would let a contract file be dropped from the audit unnoticed.
  assert.equal(spawned, 14);
  assert.equal(spawned, expectedGitSpawns);
  assert.deepEqual([...pinnedContractFiles].sort(), [
    'candidate.v1.json',
    'final-tree.v1.json',
    'lineage-contract.mjs',
    'release-contract.mjs',
    'release-manifest.v1.schema.json',
    'release-manifest.v1.template.json',
    'remediation-manifest.v1.json',
    'tree-byte-contract.mjs',
  ]);
});

test('fails closed on a wrong expected commit or tree', async () => {
  const absent = '0'.repeat(40);
  await withWorktree(head, true, async (checkout) => {
    const badCommit = await qualifyCandidate({ root: checkout, commit: absent, tree: headTree });
    const badTree = await qualifyCandidate({ root: checkout, commit: head, tree: absent });
    assert.equal(badCommit.reason, 'commit-mismatch');
    assert.equal(badTree.reason, 'tree-mismatch');
    assert.equal(badCommit.authority, false);
    assert.equal(badTree.authority, false);
  });
});

test('fails closed when a worktree contract file drifts', async () => {
  await withWorktree(head, true, async (checkout) => {
    const target = join(checkout, 'viewpro-app/scripts/production-cutover/candidate.v1.json');
    appendFileSync(target, '\n');
    const result = await qualifyCandidate({ root: checkout, commit: head, tree: headTree });
    assert.equal(result.reason, 'worktree-blob-drift');
    assert.equal(result.detail, 'candidate.v1.json');
    assert.equal(result.authority, false);
  });
});

test('fails closed when a tracked contract blob drifts', async () => {
  await withWorktree(head, true, async (checkout) => {
    const relative = 'viewpro-app/scripts/production-cutover/candidate.v1.json';
    appendFileSync(join(checkout, relative), '\n');
    git(checkout, ['add', '--', relative]);
    git(checkout, [
      '-c', 'user.email=qualification@example.invalid',
      '-c', 'user.name=Qualification Fixture',
      '-c', 'commit.gpgsign=false',
      '-c', 'core.hooksPath=/dev/null',
      'commit', '--no-verify', '-m', 'fixture: drift a pinned contract blob',
    ]);
    const drifted = git(checkout, ['rev-parse', 'HEAD']);
    const driftedTree = git(checkout, ['rev-parse', 'HEAD^{tree}']);
    const result = await qualifyCandidate({ root: checkout, commit: drifted, tree: driftedTree });
    assert.equal(result.reason, 'tracked-blob-drift');
    assert.equal(result.detail, 'candidate.v1.json');
    assert.equal(result.authority, false);
  });
});

test('agrees with Git on blob identity for real content', () => {
  for (const content of ['', 'qualification\n', 'a\0b', '\u00e1\u4e2d\n', 'x'.repeat(5000)]) {
    const bytes = Buffer.from(content);
    const expected = execFileSync('/usr/bin/git', ['hash-object', '--stdin', '-t', 'blob'], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: bytes,
    }).trim();
    assert.match(expected, /^[a-f0-9]{40}$/);
    assert.equal(blobIdentity(bytes), expected, `blob identity must match Git for ${expected}`);
  }
});
