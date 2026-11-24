export const meta = {
  name: 'universal-review',
  description: 'Team code review engine: triage a PR, review it with one finder (escalating when the code demands it), refute every finding, reconcile against the PR body and post one review',
  phases: [
    { title: 'Triage', detail: 'facts only; the script decides skip / express / full', model: 'haiku' },
    { title: 'Setup', detail: 'worktree at head SHA, filtered diff cached to disk', model: 'haiku' },
    { title: 'Find', detail: 'solo light finder; two-axis fan-out on migrations, auth, queues' },
    { title: 'Verify', detail: 'skeptic refutes each finding from code evidence' },
    { title: 'Post', detail: 'reconcile against body and threads, compose, post, tear down' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal code review engine.
//
// Lineage: Keith's review engine is the skeleton (triage → find → verify → post,
// typed agents with narrow tools, express path, solo finder with escalate, pure-JS
// consolidation). Brooke's workflow contributes the posting-stage hardening (diff
// cached once, evidence on every finding, read-before-write, read-back verify,
// base-merge-only skip, author-handle guard). Wesley contributes the whole-PR lenses
// (stated intent vs implementation, negative space, registry coherence, test plan vs
// diff, description quality, rollout order, project docs drift). Denny contributes REVIEW.md as a repo policy file, the
// pre-existing tag, and the concrete-consumer rule for regressions. Bailey contributes
// the hard size ceiling, the diff noise filter and coverage disclosure.
//
// Design rules that every edit must keep:
//   1. Agents report facts and findings. The SCRIPT makes every decision: skip vs
//      review, express vs full, dedup, evidence gate, severity floor inputs, counts.
//      A model misread can cost an unnecessary review, never an unearned approval.
//   2. Three agent types, chosen by tool surface (see ./agents/):
//        FINDER  inherits everything incl. read-only MCP; reads code, refutes claims
//        SHELL   Bash/Read/Grep/Glob only; runs fixed command blocks
//        POST    Bash/Read/Grep/Glob only; the one stage that makes text public, so it
//                structurally cannot reach a live system
//      Narrow tool lists are also the biggest cost lever: measured 42.5k vs 16.7k for
//      the same haiku task with all tools vs four.
//   3. Finders are blind to the PR narrative. They receive the author's claims only as
//      a list of testable assertions (stated_intent), never the body text. Only the
//      post stage reads the body, and only to reconcile.
//   4. Fail loudly. If nothing reviewed anything, return failed:, never posted: approve.
// ─────────────────────────────────────────────────────────────────────────────

const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})

// The skill stages this script into the working repo (the Workflow tool refuses a scriptPath
// inside the plugin cache) and passes the install root (~/.claude, or a plugin root) in args
// so reference files resolve. Plugin agents are namespaced `<plugin>:<agent>`.
const PLUGIN_ROOT = typeof _args.pluginRoot === 'string' && _args.pluginRoot ? _args.pluginRoot.replace(/\/$/, '') : null
// Agents installed under ~/.claude/agents are bare names; pass pluginName when they come from a plugin.
const PLUGIN_NAME = typeof _args.pluginName === 'string' && _args.pluginName ? _args.pluginName : ''
const REF = PLUGIN_ROOT ? `${PLUGIN_ROOT}/skills/code-review/references` : '~/.claude/skills/code-review/references'
const agentName = name => (PLUGIN_NAME ? `${PLUGIN_NAME}:${name}` : name)
const FINDER = agentName('review-finder')
const SHELL = agentName('review-shell')
const POST = agentName('review-post')

// ═════════════════════════════════════════════════════════════════════════════
// Schemas
// ═════════════════════════════════════════════════════════════════════════════

const FINDINGS_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: {
    findings: { type: 'array', items: {
      type: 'object', required: ['id', 'severity', 'file', 'short_title', 'body'],
      properties: {
        id: { type: 'string' },
        severity: { enum: ['red', 'yellow', 'blue'] },
        file: { type: 'string' }, line: { type: 'integer' },
        axis: { type: 'string' },
        // Which lens produced it (bugs, failure, tests, callers, spread, intent,
        // registry, testplan, slop, a11y, domain, convention, docs). Informational;
        // the post stage uses it for the scope line.
        lens: { type: 'string' },
        short_title: { type: 'string' }, body: { type: 'string' },
        evidence: { type: 'string' }, uncertain: { type: 'boolean' },
        // Real, verified, but not introduced by this PR (Denny's 🟣). Posted for
        // awareness, never blocks, never counted in N, exempt from the nit cap.
        pre_existing: { type: 'boolean' },
        // Which test grounds the finding; the skeptic applies the one named.
        verify_by: { enum: ['reachability', 'inspection'] },
        used_live_data: { type: 'boolean' },
      },
    } },
    files_examined: { type: 'array', items: { type: 'string' } },
  },
}

const SOLO_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: { ...FINDINGS_SCHEMA.properties, escalate: { type: 'boolean' }, escalate_reason: { type: 'string' } },
}

// `confirmed_ids` is REQUIRED alongside `refuted_ids`: a verdict that names only
// refutations is indistinguishable from a skeptic that silently examined nothing,
// and every unnamed finding would sail into the post stage wearing the finder's
// own `uncertain` flag as if the skeptic had endorsed it. Findings the skeptic
// classifies neither way are forced uncertain in the reducer below.
const VERDICTS_SCHEMA = {
  type: 'object', required: ['refuted_ids', 'confirmed_ids'],
  properties: {
    refuted_ids: { type: 'array', items: { type: 'string' } },
    confirmed_ids: { type: 'array', items: { type: 'string' } },
    mechanism_ids: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } } } },
    corrected_evidence: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, evidence: { type: 'string' } } } },
  },
}

const CONTEXT_SCHEMA = {
  type: 'object', required: ['pr_node_id'],
  properties: {
    pr_node_id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' },
    state: { type: 'string' }, isDraft: { type: 'boolean' },
    labels: { type: 'array', items: { type: 'string' } },
    comments: { type: 'array', items: { type: 'object', properties: {
      path: { type: 'string' }, line: { type: ['integer', 'null'] }, body: { type: 'string' }, author: { type: 'string' } } } },
    reviews: { type: 'array', items: { type: 'object', properties: {
      body: { type: 'string' }, state: { type: 'string' }, author: { type: 'string' }, commit_id: { type: 'string' }, submitted_at: { type: 'string' } } } },
  },
}

// Triage reports facts. Every decision below is computed in computePlan().
const TRIAGE_SCHEMA = {
  type: 'object',
  required: ['owner', 'repo', 'number', 'head_sha', 'review_mode', 'diff_base', 'observed'],
  properties: {
    owner: { type: 'string' }, repo: { type: 'string' }, number: { type: 'integer' },
    head_sha: { type: 'string' }, base_ref: { type: 'string' },
    review_mode: { enum: ['full', 'incremental'] }, diff_base: { type: 'string' },
    heavy_triggers: { type: 'array', items: { enum: ['size', 'migrations-schema', 'auth-session', 'queue-worker', 'new-export', 'new-env-db-route'] } },
    files: { type: 'array', items: { type: 'string' } },
    // Present only when the PR was small enough for triage to fetch the whole diff.
    diff: { type: 'string' },
    // The PR's claims as 0-6 testable assertions, extracted from title + body. This is
    // the ONLY form of the narrative a finder ever sees (Wesley's stated-intent block).
    stated_intent: { type: 'array', items: { type: 'string' } },
    // Repo policy file, verbatim, "" when absent (Denny's REVIEW.md).
    review_md: { type: 'string' },
    // Project doc paths present at head: root AGENTS.md / ARCHITECTURE.md plus one level
    // of docs/. Empty on a repo with no docs tree, which is the common case — the script
    // then omits the docs-drift lens from every finder prompt so nobody spends a call
    // hunting for a tree that is not there.
    docs_tree: { type: 'array', items: { type: 'string' } },
    // Description quality facts (Wesley's step 0.5). Judged, so used only for a body
    // note, never for a skip or a block unless REVIEW.md opts in.
    description: { type: 'object', properties: {
      generic_title: { type: 'boolean' }, body_empty_or_template: { type: 'boolean' },
      what_clear: { type: 'boolean' }, why_clear: { type: 'boolean' }, has_test_plan: { type: 'boolean' } } },
    pr_context: CONTEXT_SCHEMA,
    observed: {
      type: 'object',
      required: ['state', 'head_sha', 'token_owner'],
      properties: {
        state: { type: 'string' }, head_sha: { type: 'string' },
        is_draft: { type: 'boolean' }, title: { type: 'string' },
        author: { type: 'string' }, author_is_bot: { type: 'boolean' },
        token_owner: { type: 'string' },
        // Deterministic sha of the token-owner's latest substantive review, from the
        // rigid jq in triage.md. The already-reviewed skip rides on this field only.
        token_owner_review_sha: { type: 'string' },
        // Brooke's base-merge-only check: the PR's own {filename, blob sha} set at the
        // prior-reviewed sha and at head. Equal → nothing of the author's changed.
        net_files_at_head: { type: 'string' }, net_files_at_prior: { type: 'string' },
        additions: { type: 'integer' }, deletions: { type: 'integer' },
        labels: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}

const EXPRESS_SCHEMA = {
  type: 'object', required: ['line'],
  properties: {
    line: { type: 'string', minLength: 1 }, escalate: { type: 'boolean' }, escalate_reason: { type: 'string' },
    // dryRun only — mirrors STATUS_SCHEMA.review so the express lane is scorable.
    review: {
      type: 'object',
      properties: {
        event: { enum: ['APPROVE', 'COMMENT'] },
        body: { type: 'string' },
        inline_comments: { type: 'array', items: { type: 'object' } },
      },
    },
  },
}

const WORKTREE_SCHEMA = {
  type: 'object', required: ['ok'],
  properties: {
    ok: { type: 'boolean' }, path: { type: 'string' }, head_sha: { type: 'string' }, main_clone: { type: 'string' },
    diff_path: { type: 'string' },              // filtered diff on disk, read by finders
    filtered_lines: { type: 'integer' }, raw_lines: { type: 'integer' },
    filtered_out: { type: 'array', items: { type: 'string' } },   // paths the noise filter dropped
    error: { type: 'string' },
  },
}

const STATUS_SCHEMA = {
  type: 'object', required: ['line'],
  properties: {
    line: { type: 'string', minLength: 1 }, torn_down: { type: 'boolean' },
    // Populated on dryRun only: the composed review that WOULD have been posted.
    // Without this the composed body never leaves the post agent (it is only
    // log()ed), so nothing downstream — the eval harness above all — can score
    // what the skill actually writes.
    review: {
      type: 'object',
      properties: {
        event: { enum: ['APPROVE', 'COMMENT'] },
        body: { type: 'string' },
        inline_comments: {
          type: 'array',
          items: {
            type: 'object', required: ['path', 'body'],
            properties: { path: { type: 'string' }, line: { type: ['integer', 'null'] }, body: { type: 'string' } },
          },
        },
      },
    },
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// REVIEW.md policy (Denny). Parsed here so the script, not an agent, applies it.
// Format is flat `key: value` lines; see references/review-md.md.
// ═════════════════════════════════════════════════════════════════════════════

const POLICY_DEFAULTS = {
  nit_cap: 5,
  max_lines: 50000,                       // Bailey's hard ceiling
  block_on_missing_description: false,    // Wesley's gate, opt-in
  no_auto_approve: false,                 // Bailey's per-repo list, as a flag
  review_drafts: false,
  skip_paths: [],
  must_check: [],
  standards_skills: [],
}

function parsePolicy(text) {
  const p = { ...POLICY_DEFAULTS, skip_paths: [], must_check: [], standards_skills: [] }
  if (!text) return p
  let listKey = null
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trimEnd()
    if (!line.trim()) continue
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item && listKey) { p[listKey].push(item[1].trim().replace(/^["']|["']$/g, '')); continue }
    const kv = line.match(/^([a-z_]+):\s*(.*)$/)
    if (!kv) continue
    const [, k, v] = kv
    listKey = null
    if (!(k in POLICY_DEFAULTS)) continue
    if (Array.isArray(POLICY_DEFAULTS[k])) {
      const inline = v.match(/^\[(.*)\]$/)
      if (inline) p[k] = inline[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      else if (!v.trim()) listKey = k
    } else if (typeof POLICY_DEFAULTS[k] === 'boolean') p[k] = /^(true|yes|on)$/i.test(v.trim())
    else if (typeof POLICY_DEFAULTS[k] === 'number') { const n = parseInt(v, 10); if (Number.isFinite(n)) p[k] = n }
  }
  return p
}

// ═════════════════════════════════════════════════════════════════════════════
// Plan: everything the script decides from triage, before any expensive agent runs.
// ═════════════════════════════════════════════════════════════════════════════

const DEEP_TRIGGERS = new Set(['migrations-schema', 'auth-session', 'queue-worker'])
const RISKY_PATH = /(^|\/)(migrations?|auth[^/]*|permissions?|security|terraform|helm)(\/|\.|$)|\.(sql|tf|tfvars)$|(^|\/)Dockerfile[^/]*$|^\.github\/workflows\//i
const PROTO_TITLE = /^\s*\[proto\]/i
const STOP_LABEL = /^(do[- ]?not[- ]?merge|wip|hold|blocked)$/i

function computeSkip(t, policy, force) {
  const o = t.observed || {}
  if (/^(CLOSED|MERGED|LOCKED)$/i.test(o.state || '')) return 'skipped: closed-or-merged'
  if (PROTO_TITLE.test(o.title || '')) return 'skipped: prototype'
  if (o.is_draft && !policy.review_drafts) return 'skipped: draft'
  if (o.author_is_bot) return 'skipped: bot-author'
  const total = (o.additions || 0) + (o.deletions || 0)
  if (policy.max_lines > 0 && total > policy.max_lines) return `skipped: too-large (${total} > ${policy.max_lines} lines)`
  if (force) return null
  if (!!o.head_sha && o.token_owner_review_sha === o.head_sha) return 'skipped: already-reviewed'
  // Head moved since our review, but the PR's own contribution is byte-identical:
  // the author only merged or rebased the base branch. Nothing to re-review.
  if (o.token_owner_review_sha && o.net_files_at_head && o.net_files_at_prior && o.net_files_at_head === o.net_files_at_prior) {
    return 'skipped: base-merge-only'
  }
  return null
}

// Description quality (Wesley). Returns a note for the post stage, or ''.
function describeGaps(t) {
  const d = t.description || {}
  const gaps = []
  if (d.generic_title) gaps.push('the title does not say what changed')
  if (d.body_empty_or_template) gaps.push('the body is empty or an unfilled template')
  else {
    if (d.what_clear === false) gaps.push('what changed is not clear from the body')
    if (d.why_clear === false) gaps.push('why it is changing is not explained')
  }
  const nonTrivial = ((t.observed?.additions || 0) + (t.observed?.deletions || 0) > 50) || (t.files || []).length > 3
  if (nonTrivial && d.has_test_plan === false) gaps.push('no test plan or verification notes on a non-trivial diff')
  return gaps
}

// ═════════════════════════════════════════════════════════════════════════════
// Find → consolidate → Verify (shared by solo and fan-out paths)
// ═════════════════════════════════════════════════════════════════════════════

const finderPrompt = (plan, ref) =>
  `Read ${REF}/axes/${ref}.md. Work in ${plan.workdir} — cd there first. Your tool-call budget is ${plan.toolBudget}. ${plan.diffScope}${plan.fileScope}
The filtered PR diff is already on disk at ${plan.diffPath} — Read it (once) instead of running git diff for the whole PR; use scoped \`git diff\` only for a file you need with more context. If the repo root has a CLAUDE.md or CONTRIBUTING.md, read it first (free, does not count toward your budget) and treat its rules as loaded repo conventions.${plan.mustCheck.length ? `\nREPO MUST-CHECK RULES (from REVIEW.md, treat as invariants to verify): ${JSON.stringify(plan.mustCheck)}` : ''}${plan.docsTree.length ? `\nPROJECT DOCS present at head — apply Lens 10 (docs drift) against exactly these paths, and no others: ${JSON.stringify(plan.docsTree)}. Your budget above already carries 2 calls for it.` : ''}${plan.statedIntent.length ? `\nSTATED INTENT — the author's claims, as assertions to TEST against the code, not facts to trust: ${JSON.stringify(plan.statedIntent)}` : '\nSTATED INTENT: none extracted (PR body was empty or non-specific); skip the intent lens.'}
Return FINDINGS_SCHEMA. Every red/yellow finding MUST set \`evidence\`: quote the exact changed line(s) and state the concrete failure they cause — red/yellow findings without evidence are auto-downgraded one severity. Set \`verify_by\` on every finding (\`reachability\` by default; \`inspection\` only when the changed lines are wrong on their own with no caller involved). Set \`pre_existing: true\` on a real bug that lives in code the diff touches or depends on but that this PR did not introduce. Set \`lens\` to the lens that produced each finding. Return \`files_examined\`: the changed files you actually read (report honestly; gaps are disclosed, never penalised). If nothing applies, return {"findings": [], "files_examined": []}. Apply the self-filter your axis file mandates before reporting.`

async function find(plan) {
  phase('Find')
  const call = (ref, label, schema) => agent(
    finderPrompt(plan, ref) + (schema === SOLO_SCHEMA ? ` This axis returns ${ref}.md's output shape: FINDINGS_SCHEMA fields plus optional escalate/escalate_reason.` : ''),
    { model: 'opus', effort: plan.effort, agentType: FINDER, schema, label: `find:${label}`, phase: 'Find' }
  ).catch(() => null)

  const fanOut = async () => ({
    results: await parallel(plan.axes.map(ax => () => call(ax.ref, ax.key, FINDINGS_SCHEMA))),
    axesRun: plan.axes,
  })

  if (!plan.soloAxis) return fanOut()
  const solo = await call(plan.soloAxis, plan.soloAxis, SOLO_SCHEMA)
  if (solo && !solo.escalate) return { results: [solo], axesRun: [{ key: plan.soloAxis }] }
  log(`${plan.tag}: ${plan.soloAxis} finder ${solo ? `escalated (${solo.escalate_reason || 'no reason given'})` : 'failed'} — running the full axis set`)
  return fanOut()
}

const isEvidenced = f => typeof f.evidence === 'string' && f.evidence.trim().length >= 20
const SEV = { red: 3, yellow: 2, blue: 1 }

// Re-key, dedup, gate on evidence, account for unexamined files. Pure JS.
function consolidate(plan, results, axesRun) {
  const failedAxes = axesRun.filter((_, i) => !results[i]).map(ax => ax.key)
  if (failedAxes.length) log(`${plan.tag}: finder axis failed — coverage reduced: ${failedAxes.join(', ')}`)

  const raw = results.filter(Boolean).flatMap(r => r.findings).map((f, i) => ({ ...f, id: `${f.id || 'f'}~${i}` }))

  const norm = p => (p.startsWith(`${plan.workdir}/`) ? p.slice(plan.workdir.length + 1) : p).replace(/^\.\//, '')
  const reporters = results.filter(r => r && Array.isArray(r.files_examined))
  let coverageGaps = []
  if (plan.changedFiles.length && reporters.length) {
    const examined = new Set(reporters.flatMap(r => r.files_examined).map(norm))
    coverageGaps = plan.changedFiles.filter(f => !examined.has(norm(f)))
    if (coverageGaps.length) log(`${plan.tag}: coverage gaps — no finder examined: ${coverageGaps.slice(0, 10).join(', ')}${coverageGaps.length > 10 ? ` (+${coverageGaps.length - 10} more)` : ''}`)
  }

  // Skip-paths from REVIEW.md: findings in generated/vendored files are not actionable.
  const skipped = plan.skipPaths.length ? raw.filter(f => plan.skipPaths.some(g => globMatch(g, norm(f.file || '')))) : []
  if (skipped.length) log(`${plan.tag}: dropped ${skipped.length} finding(s) in REVIEW.md skip_paths`)
  const kept = raw.filter(f => !skipped.includes(f))

  const deduped = []
  for (const f of kept) {
    const di = deduped.findIndex(g =>
      g.file === f.file && Math.abs((g.line || 0) - (f.line || 0)) <= 3 &&
      g.short_title.toLowerCase().slice(0, 24) === f.short_title.toLowerCase().slice(0, 24))
    if (di === -1) { deduped.push(f); continue }
    const g = deduped[di]
    const keep = (!isEvidenced(g) && isEvidenced(f)) ? f : g
    deduped[di] = {
      ...keep,
      severity: (SEV[f.severity] || 0) > (SEV[g.severity] || 0) ? f.severity : g.severity,
      uncertain: !!(f.uncertain && g.uncertain),
      pre_existing: !!(f.pre_existing && g.pre_existing),
    }
  }

  let downgradedCount = 0
  const gated = deduped.map(f => {
    if (f.severity === 'blue' || isEvidenced(f)) return f
    downgradedCount++
    return { ...f, severity: f.severity === 'red' ? 'yellow' : 'blue', uncertain: true, downgraded_from: f.severity }
  })
  if (downgradedCount) log(`${plan.tag}: evidence gate downgraded ${downgradedCount} unevidenced finding(s)`)
  log(`${plan.tag}: ${gated.length} findings after dedup`)
  return { gated, failedAxes, coverageGaps }
}

// Minimal glob: `**` any depth, `*` within a segment, trailing `/` means prefix.
function globMatch(glob, path) {
  if (glob.endsWith('/')) return path.startsWith(glob) || path.includes(`/${glob}`)
  const re = new RegExp('^' + glob.split('**').map(s => s.split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$')
  return re.test(path)
}

const needsVerify = f => f.severity !== 'blue' || f.downgraded_from

async function verify(plan, gated) {
  phase('Verify')
  const toVerify = gated.filter(needsVerify)
  const passThrough = gated.filter(f => !needsVerify(f))
  if (!toVerify.length) {
    if (gated.length) log(`${plan.tag}: ${gated.length} finding(s), all blue nits — skeptic skipped`)
    return { verified: gated, skepticNote: '' }
  }

  const byFile = new Map()
  for (const f of toVerify) byFile.set(f.file, [...(byFile.get(f.file) || []), f])
  const groups = toVerify.length > 8 ? [[], []] : [[]]
  let gi = 0
  for (const fs of byFile.values()) groups[gi++ % groups.length].push(...fs)
  const ran = groups.filter(g => g.length)

  const verdicts = await parallel(ran.map((g, i) => () =>
    agent(
      `Read ${REF}/skeptic.md. Work in ${plan.workdir} — cd there. ${plan.skepticScope} Read/grep budget: ~${plan.verifyReads(g.length)} — spend it on the grounding check. Findings to refute:\n${JSON.stringify(g)}\nReturn VERDICTS_SCHEMA.`,
      { model: 'opus', effort: plan.effort, agentType: FINDER, schema: VERDICTS_SCHEMA, label: `verify:${i + 1}`, phase: 'Verify' }
    ).catch(() => null)))

  const ok = verdicts.filter(Boolean)
  if (!ok.length) {
    log(`${plan.tag}: skeptic failed — findings unverified`)
    return {
      verified: toVerify.map(f => ({ ...f, uncertain: true })).concat(passThrough),
      skepticNote: '\nWARNING: skeptic verification DID NOT RUN — these findings are UNVERIFIED and all marked uncertain. Do not claim any verification work in the review.',
    }
  }

  const killed = new Set(ok.flatMap(v => v.refuted_ids))
  const confirmed = new Set(ok.flatMap(v => v.confirmed_ids || []))
  const mechanism = new Set(ok.flatMap(v => v.mechanism_ids || []))
  const unverifiedIds = new Set(ran.flatMap((g, i) => verdicts[i] ? [] : g.map(f => f.id)))
  const corrections = new Map(ok.flatMap(v => v.corrected_evidence || []).map(c => [c.id, c.evidence]))

  const survivors = toVerify.filter(f => !killed.has(f.id)).map(f => {
    const g = confirmed.has(f.id) ? { ...f, uncertain: false, severity: f.downgraded_from || f.severity }
      : mechanism.has(f.id) ? { ...f, mechanism: true, severity: f.downgraded_from || f.severity }
        // Unlisted is NOT verified. A finding the skeptic returned without
        // classifying was never refuted and never confirmed, so it goes to the
        // post stage as uncertain rather than inheriting a clean bill of health.
        : { ...f, uncertain: true }
    return corrections.has(f.id) ? { ...g, evidence: corrections.get(f.id) } : g
  })

  let skepticNote = ''
  if (unverifiedIds.size) {
    log(`${plan.tag}: a skeptic group failed — its findings are unverified`)
    skepticNote = '\nWARNING: a skeptic group FAILED — its findings are now marked uncertain and are UNVERIFIED. Do not claim verification for any uncertain finding.'
  }
  log(`${plan.tag}: ${survivors.length}/${toVerify.length} findings survived verification${mechanism.size ? `, ${mechanism.size} mechanism-confirmed` : ''}${passThrough.length ? ` (+${passThrough.length} blue nit(s) unverified)` : ''}`)
  return { verified: survivors.concat(passThrough), skepticNote }
}

// ═════════════════════════════════════════════════════════════════════════════
// Main
// ═════════════════════════════════════════════════════════════════════════════

async function runPr() {
  const { url, dryRun = false } = _args
  const forceFull = _args.forceFull === true

  // ONE anchored parse, used for both validation and the owner/repo/number split —
  // two regexes drift, and the looser one decides what gets reviewed. Anchored after
  // the number so only a trailing /path, ?query or #fragment may follow: unanchored,
  // a typo'd `.../pull/123abc` matched as PR 123 and silently reviewed a real,
  // different PR instead of being rejected.
  // v1 is GitHub only. GitLab support lands as *-gitlab.md twins of triage/worktree/
  // posting selected here by provider, as in Keith's engine.
  //
  // owner/repo are restricted to GitHub's own slug charset rather than `[^/]+`. Both
  // land in shell assignments inside triage.md and worktree.md, so `[^/]+` let a
  // crafted URL carry `;`, backticks or $( ) into a Bash call the agent runs verbatim.
  // GitHub owners are alnum plus single hyphens (≤39); repo names add `.` and `_`.
  const m = typeof url === 'string'
    ? url.match(/^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})\/pull\/(\d+)(?:[/?#].*)?$/)
    : null
  if (!m) return `failed: missing-or-invalid-url (${JSON.stringify(url)}) — GitHub PR URLs only in this build`
  const projectPath = `${m[1]}/${m[2]}`
  const urlRepo = m[2]
  const urlNumber = m[3]

  const teardownWt = (p, mainClone) => agent(
    `Read ${REF}/worktree.md and run TEARDOWN for worktree at ${p} (owner ${m[1]}, repo ${urlRepo}${mainClone ? `, main clone at ${mainClone}` : ''}, PR ${urlNumber}).`,
    { model: 'haiku', effort: 'low', agentType: SHELL, label: 'worktree:teardown' }).catch(() => null)

  // ── Triage ────────────────────────────────────────────────────────────────
  phase('Triage')
  const triage = await agent(`Read ${REF}/triage.md and triage this PR: ${url}. Return TRIAGE_SCHEMA JSON only.`,
    { model: 'haiku', effort: 'low', agentType: SHELL, schema: TRIAGE_SCHEMA, label: 'triage', phase: 'Triage' }).catch(() => null)
  if (!triage) return 'failed: triage-skipped'
  const tag = `${triage.repo}#${triage.number}`

  const policy = parsePolicy(triage.review_md || '')
  if (triage.review_md) log(`${tag}: REVIEW.md loaded (nit_cap=${policy.nit_cap}, max_lines=${policy.max_lines}, skip_paths=${policy.skip_paths.length}, must_check=${policy.must_check.length})`)

  if (forceFull) {
    triage.review_mode = 'full'
    triage.diff_base = `origin/${triage.base_ref || 'HEAD'}`
    log(`${tag}: forced full re-review (already-reviewed skip bypassed)`)
  }
  // diff_base reaches worktree.md as shell source. It is derived from the repo's own
  // base branch name, and git permits `$`, backticks, quotes and `;` in a ref, so a
  // crafted base branch on a repo we do not control could execute during setup.
  // Everything legitimate here is a ref or a sha, so hold it to that charset.
  if (!/^[A-Za-z0-9._\/-]+$/.test(triage.diff_base || '')) {
    log(`${tag}: refusing unsafe diff_base ${JSON.stringify(triage.diff_base)}`)
    return 'failed: unsafe-diff-base'
  }

  const skipStatus = computeSkip(triage, policy, forceFull)
  if (skipStatus) { log(`${tag}: ${skipStatus}`); return skipStatus }

  const o = triage.observed || {}
  const selfAuthored = !!o.author && !!o.token_owner && o.author.toLowerCase() === o.token_owner.toLowerCase()
  const stopLabel = (o.labels || []).some(l => STOP_LABEL.test(l))
  const descriptionGaps = describeGaps(triage)
  const prFiles = (triage.files || []).filter(f => typeof f === 'string' && f)
  // Gate for Lens 10: no docs tree at head → the lens never reaches a finder prompt.
  const docsTree = (Array.isArray(triage.docs_tree) ? triage.docs_tree : [])
    .filter(d => typeof d === 'string' && d.trim()).slice(0, 20)
  const adds = o.additions, dels = o.deletions

  // ── Express (Keith) ───────────────────────────────────────────────────────
  // Arithmetic on triage's numbers, never its judgment: a misread costs an unneeded
  // full review, never an unearned approval. The agent still READS the diff.
  // Deep triggers are semantic: triage reports them from the code, and RISKY_PATH
  // cannot stand in for them (plenty of queue/worker/scheduler files match no path
  // pattern at all). Computed here because the express gate below must respect the
  // same triggers that route the full pipeline.
  const deepTriggers = (Array.isArray(triage.heavy_triggers) ? triage.heavy_triggers : []).filter(t => DEEP_TRIGGERS.has(t))

  const tinyBounds = Number.isInteger(adds) && Number.isInteger(dels) && adds + dels <= 15 &&
    prFiles.length >= 1 && prFiles.length <= 2 && !prFiles.some(f => RISKY_PATH.test(f))
  const expressAllowed = tinyBounds && !forceFull && !selfAuthored && !stopLabel &&
    !policy.no_auto_approve && descriptionGaps.length === 0 &&
    // A semantic deep trigger outranks a small diff: 15 lines of queue or auth code
    // is exactly the change that needs the domain pass, not an express approval.
    !deepTriggers.length &&
    // Express composes from the diff alone. An incremental review must reconcile
    // the prior round's unresolved threads, so a small follow-up commit cannot be
    // waved through without the post stage ever reading them.
    triage.review_mode !== 'incremental' &&
    // Drafts only reach here when REVIEW.md sets review_drafts; that opt-in buys a
    // comment-only review, never an approval.
    !o.is_draft
  if (expressAllowed && typeof triage.diff === 'string' && triage.diff.trim()) {
    const express = await agent(
      `A ${adds}+${dels} line change across ${prFiles.length} file(s) in ${projectPath}#${urlNumber}. Here is the ENTIRE diff:\n\n${triage.diff}\n\nDecide one of two things, and do NOT fetch the PR, clone anything, or read other files.\n\nAPPROVE if the change is self-evidently safe on its own terms: it does what it says and nothing in these lines can alter behaviour in a way worth a human's attention.\n\nFirst confirm the head has not moved since triage — if it has, the diff above is stale and you must ESCALATE instead:\n  test "$(gh pr view ${urlNumber} --repo ${projectPath} --json headRefOid -q .headRefOid)" = "${triage.head_sha}" || echo HEAD_MOVED\n\nThen post. NEVER interpolate your body into the command line: backticks, quotes and $( ) in it would run as shell. Write it to a file and pass the file:\n  mkdir -p /tmp/universal-review/express\n  cat > /tmp/universal-review/express/${m[1]}-${urlRepo}-${urlNumber}.md << 'BODY_EOF'\n  <your body>\n  BODY_EOF\n  gh pr review ${urlNumber} --repo ${projectPath} --approve --body-file /tmp/universal-review/express/${m[1]}-${urlRepo}-${urlNumber}.md\nThe body opens with the line \`_Reviewed using Hyperion shared code review skill_\` followed by a blank line, then one line stating what changed and that it was reviewed whole, ending with the line \`<!-- universal-review:reviewed sha=${triage.head_sha} mode=express -->\`. Then return {"line": "posted: approve"}.\n\nESCALATE if you are not certain — a changed condition, a version you cannot vouch for, a config the runtime reads, anything you would want traced. Post NOTHING and return {"escalate": true, "escalate_reason": "<one line>", "line": "escalated"}. Escalating is cheap and correct; a wrong approval is not.${dryRun ? '\n\nDRY RUN: post nothing. log() what you would have posted and return {"line": "dry-run: approve", "review": {"event": "APPROVE", "body": "<the body you would have posted>", "inline_comments": []}}.' : ''}`,
      { model: 'sonnet', effort: 'medium', agentType: SHELL, schema: EXPRESS_SCHEMA, label: 'express', phase: 'Triage' }
    ).catch(() => null)
    // ONLY an approve ends the review here. Any other line — `failed: ...`, a status
    // the agent invented, an empty string — means express did not approve anything,
    // and returning it would skip Setup/Find/Post entirely on the strength of a
    // malformed response. Everything else falls through to the full pipeline.
    const expressApproved = express && !express.escalate &&
      /^(posted|dry-run): approve$/.test((express.line || '').trim())
    if (expressApproved) {
      log(`${tag}: express approve (${adds}+${dels} lines, ${prFiles.length} file(s)) — no worktree, no finder`)
      // Return the same {line, review} shape the post stage does, so --dry-run
      // shows the express draft and the eval harness can score this lane too.
      return express.review ? { line: express.line, review: express.review } : express.line
    }
    log(`${tag}: express ${express ? (express.escalate ? `escalated — ${express.escalate_reason || 'no reason given'}` : `returned ${JSON.stringify(express.line)} rather than an approval`) : 'failed'}, running the full review`)
  }

  // ── Setup ─────────────────────────────────────────────────────────────────
  phase('Setup')
  const wt = await agent(`Read ${REF}/worktree.md and run SETUP for ${projectPath} #${urlNumber} with diff base ${triage.diff_base}. Return WORKTREE_SCHEMA.`,
    { model: 'haiku', effort: 'low', agentType: SHELL, schema: WORKTREE_SCHEMA, label: 'worktree:setup', phase: 'Setup' }).catch(() => null)
  if (!wt || !wt.ok || !wt.path) return `failed: worktree-setup (${wt?.error || 'skipped-or-unknown'})`

  if (wt.head_sha && wt.head_sha !== triage.head_sha) {
    log(`${tag}: head moved during setup (${(triage.head_sha || 'unresolved').slice(0, 8)} → ${wt.head_sha.slice(0, 8)}) — reviewing ${wt.head_sha.slice(0, 8)}`)
    triage.head_sha = wt.head_sha
  }
  if (wt.filtered_out?.length) log(`${tag}: noise filter dropped ${wt.filtered_out.length} path(s) from the diff (${wt.raw_lines || '?'} → ${wt.filtered_lines || '?'} lines)`)

  let statusLine = 'failed: incomplete'
  let tornDown = false
  let composed = null
  try {
    // ── Find ────────────────────────────────────────────────────────────────

    const axes = [
      { key: 'diff', ref: 'diff-review' },
      deepTriggers.length ? { key: 'domain', ref: 'domain-safety' } : { key: 'context', ref: 'context' },
    ]
    const bigPR = prFiles.length > 150 || prFiles.length === 100
    // Only a SEMANTIC trigger skips the light pass. Size measures volume, not risk.
    const soloAxis = deepTriggers.length ? null : 'light'
    if (!soloAxis) log(`${tag}: ${deepTriggers.join(', ')} — skipping the light pass, running diff-review + domain-safety`)

    const plan = {
      tag,
      workdir: wt.path,
      diffPath: wt.diff_path || `${wt.path}/.review/pr.diff`,
      effort: 'low',
      // The docs lens is the only one that reaches outside the code, so it is the only one
      // that gets its own calls rather than diluting the others' budget.
      toolBudget: 12 + (docsTree.length ? 2 : 0),
      docsTree,
      axes,
      soloAxis,
      statedIntent: Array.isArray(triage.stated_intent) ? triage.stated_intent.slice(0, 6) : [],
      mustCheck: policy.must_check,
      skipPaths: policy.skip_paths,
      changedFiles: (triage.review_mode === 'full' && !bigPR) ? prFiles : [],
      diffScope: (triage.review_mode === 'incremental'
        ? `PR: ${projectPath}#${urlNumber}. Review ONLY the delta diff ${triage.diff_base}..${triage.head_sha}. Full files are readable from the worktree for context. If git cannot resolve ${triage.diff_base}, run \`git fetch origin ${triage.diff_base}\` in the worktree; if it STILL fails, review the full PR diff vs the remote base branch instead and note that the delta base was unfetchable.`
        : `PR: ${projectPath}#${urlNumber}. Review the full PR diff (base ${triage.diff_base}).`),
      fileScope: prFiles.length && !bigPR
        ? ` This PR's own changed files: ${JSON.stringify(prFiles)} — changes to any OTHER file inside the diff range arrived via a base-branch merge, are NOT this PR's code, and must not be flagged (reading them as evidence is fine).`
        : '',
      skepticScope: `Diff scope: ${triage.diff_base}..${triage.head_sha} (filtered diff at ${wt.diff_path || 'the worktree'}; run scoped git diff in the worktree for more; review_mode: ${triage.review_mode}).`,
      verifyReads: n => Math.min(24, Math.max(4, n * 3)),
    }

    const contextAgent = () => agent(
      `Fetch the body-aware PR context the post stage needs for ${projectPath} #${urlNumber}:
  gh pr view ${urlNumber} --repo ${projectPath} --json id,title,body,state,isDraft,labels,headRefOid
  gh api "repos/${projectPath}/pulls/${urlNumber}/comments?per_page=100" --paginate | jq -s 'add // []' | jq -c '[.[] | {path, line, body: (.body | .[0:250]), author: .user.login}][-15:]'
  gh api "repos/${projectPath}/pulls/${urlNumber}/reviews?per_page=100" --paginate | jq -s 'add // []' | jq -c '[.[] | {body: (.body | .[0:400]), state, author: .user.login, commit_id, submitted_at}][-15:]'
Return CONTEXT_SCHEMA (pr_node_id = the .id field; labels = label names). No prose.`,
      { model: 'haiku', effort: 'low', agentType: SHELL, schema: CONTEXT_SCHEMA, label: 'pr-context(fallback)', phase: 'Find' }
    ).catch(() => null)

    const ctxPromise = triage.pr_context?.pr_node_id
      ? Promise.resolve(triage.pr_context)
      : (log(`${tag}: triage returned no pr_context — fetching it with a fallback agent`), contextAgent())

    const { results, axesRun } = await find(plan)
    const prContext = await ctxPromise

    if (results.every(r => !r)) {
      log(`${tag}: ALL finder axes failed — aborting, nothing was reviewed`)
      return 'failed: all-finders-failed'
    }
    const { gated, failedAxes, coverageGaps } = consolidate(plan, results, axesRun)
    const { verified, skepticNote } = await verify(plan, gated)

    // ── Post ────────────────────────────────────────────────────────────────
    phase('Post')
    const notes = []
    if (failedAxes.length) notes.push(`NOTE: these finder axes FAILED this run and produced no coverage: ${failedAxes.join(', ')}. Word the scope line so it does not imply that coverage happened.`)
    if (coverageGaps.length) notes.push(`Coverage gaps — changed files NO finder reports examining: ${JSON.stringify(coverageGaps.slice(0, 30))}${coverageGaps.length > 30 ? ` (+${coverageGaps.length - 30} more)` : ''}. Do not imply full coverage; word the scope line honestly.`)
    else if (bigPR) notes.push('NOTE: this PR changes >150 files — the merge-noise file-scope guard and coverage accounting were disabled. Word the scope line to reflect partial tracking.')
    if (wt.filtered_out?.length) notes.push(`Noise filter excluded these paths from review (lockfiles, vendored, generated, build output): ${JSON.stringify(wt.filtered_out.slice(0, 20))}. Mention only if a finding would have needed them.`)
    const liveIds = verified.filter(f => f.used_live_data).map(f => f.id)
    if (liveIds.length) notes.push(`LIVE-DATA FILTER — these finding ids leaned on a live system query: ${JSON.stringify(liveIds)}. Keep the conclusion, strip every concrete value that came from the query. A claim you cannot state without quoting live data must be dropped or reworded as a question.`)
    if (descriptionGaps.length) notes.push(`DESCRIPTION GAPS (Wesley's check): ${descriptionGaps.join('; ')}. ${policy.block_on_missing_description ? 'REVIEW.md sets block_on_missing_description: true — outcome is forced to comment and the body opens with the gaps.' : 'Open the body with one line naming the gaps; this never changes the outcome on its own.'}`)
    if (selfAuthored) notes.push('SELF-AUTHORED: the token owner wrote this PR. GitHub blocks self-approval — post event COMMENT with the "Would approve" heading if the verdict is clean.')
    if (stopLabel) notes.push(`STOP LABEL present (${(o.labels || []).filter(l => STOP_LABEL.test(l)).join(', ')}): outcome is forced to comment.`)
    if (policy.no_auto_approve) notes.push('REVIEW.md sets no_auto_approve: true — never APPROVE; comment-only with a line flagging for human approval.')

    const result = await agent(
      `Read ${REF}/reconcile.md. PR: ${url}. Worktree: ${wt.path}. dryRun: ${dryRun}. review_mode: ${triage.review_mode}, diff_base: ${triage.diff_base}, head: ${triage.head_sha}.
POLICY (from REVIEW.md, already parsed — apply as given): ${JSON.stringify({ nit_cap: policy.nit_cap, block_on_missing_description: policy.block_on_missing_description, no_auto_approve: policy.no_auto_approve, standards_skills: policy.standards_skills })}
PR CONTEXT (already fetched — do NOT re-fetch unless null; reconcile.md's freshness re-check of the reviews list still applies):
${prContext ? JSON.stringify(prContext) : 'null'}
Verified findings:
${JSON.stringify(verified)}${skepticNote}${notes.length ? '\n' + notes.join('\n') : ''}
Apply drop/agree/keep + gates, compose and post per ${REF}/posting.md, post (or log if dryRun), then return STATUS_SCHEMA.${wt.main_clone ? `

AFTER posting — and only after — tear down the worktree in ONE bash call (idempotent):
  cd "${wt.main_clone}" 2>/dev/null; git worktree remove --force "${wt.path}" 2>/dev/null || true; git update-ref -d "refs/pr-review/${urlNumber}" 2>/dev/null || true
Set \`torn_down\` true ONLY if that call ran; otherwise false and still return your real status line.` : `\n\nDo NOT tear down the worktree — return \`torn_down\`: false.`}`,
      { model: 'sonnet', effort: 'low', agentType: POST, schema: STATUS_SCHEMA, label: 'post', phase: 'Post' }
    ).catch(() => null)
    statusLine = result?.line || 'failed: post-skipped'
    tornDown = result?.torn_down === true
    // On a dry run the composed review is the whole point of the call — carry it
    // out alongside the status line so a caller can inspect what would be posted.
    if (dryRun && result?.review) composed = result.review
  } finally {
    if (!tornDown) await teardownWt(wt.path, wt.main_clone)
  }
  return composed ? { line: statusLine, review: composed } : statusLine
}

// One return shape for every path. runPr's early exits are bare status strings
// (`skipped: draft`, `failed: triage-skipped`); normalizing here means callers
// read `.line` once instead of type-switching per outcome.
const outcome = await runPr()
return typeof outcome === 'string' ? { line: outcome } : outcome
