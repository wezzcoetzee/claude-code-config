export const meta = {
  name: 'workflow-subagents-implementation',
  description: 'Implement a plan stage by stage with Opus/Sonnet subagents, verifying every stage',
  phases: [
    { title: 'Implement', detail: 'one subagent per stage, in dependency order' },
    { title: 'Verify', detail: 'a skeptical Opus verifier per stage attempt' },
  ],
}

// args: { plan, requirements: { R1: '...' }, stages: [...], answers: { stageId: [{ question, answer }] }, done: { stageId: result } }
// A stage: { id, title, goal, requirements: ['R1'], files: ['src/x.ts'], verify, model: 'opus' | 'sonnet', dependsOn: ['otherId'] }

const MAX_FIX_ROUNDS = 2

const IMPLEMENT_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'questions'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          why: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
        required: ['question', 'why'],
      },
    },
  },
  required: ['status', 'summary'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          met: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['id', 'met', 'evidence'],
      },
    },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['pass', 'requirements', 'problems'],
}

const { plan, requirements, stages, answers = {}, done = {} } = args
const byId = Object.fromEntries(stages.map(s => [s.id, s]))

function assertAcyclic() {
  const state = {}
  const visit = (id, path) => {
    if (!byId[id]) throw new Error(`Stage "${path.at(-1)}" depends on unknown stage "${id}"`)
    if (state[id] === 'visiting') throw new Error(`Dependency cycle: ${[...path, id].join(' -> ')}`)
    if (state[id] === 'visited') return
    state[id] = 'visiting'
    for (const dep of byId[id].dependsOn ?? []) visit(dep, [...path, id])
    state[id] = 'visited'
  }
  stages.forEach(s => visit(s.id, []))
}

const bullets = items => items.map(item => `- ${item}`).join('\n')
const requirementList = stage => bullets(stage.requirements.map(id => `${id}: ${requirements[id]}`))

function implementPrompt(stage, upstream, problems) {
  const answered = answers[stage.id] ?? []
  return [
    `You are one of several subagents implementing a plan. You own stage ${stage.id}; other subagents own the other stages and may be editing the tree at the same time.`,
    `## Stage ${stage.id}: ${stage.title}\n\n${stage.goal}`,
    `## Requirements this stage must satisfy\n\n${requirementList(stage)}`,
    `## Files you own\n\n${bullets(stage.files)}\n\nEdit only these. If the stage cannot be done without touching another file, ask.`,
    `## Verification this stage must pass\n\n${stage.verify}`,
    upstream.length && `## Stages already completed that this one builds on\n\n${upstream.map(u => `### ${u.id}\n${u.summary}\nFiles: ${(u.filesChanged ?? []).join(', ')}`).join('\n\n')}`,
    answered.length && `## Answers from the lead to your earlier questions\n\n${answered.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}`,
    problems && `## A verifier rejected your previous attempt\n\nFix every one of these:\n\n${bullets(problems)}`,
    `## The full plan, for context\n\n${plan}`,
    `## How to work

1. Explore the code you will touch before editing anything. The tree may already hold partial work from an earlier attempt at this stage; build on it.
2. If the plan, the code, and the answers above leave a decision open where a wrong guess means rework, stop before editing and return status "questions". The lead answers them or asks the human, then re-runs you. For any smaller decision, choose and record it in assumptions.
3. Implement the stage, then run its verification yourself and keep going until it passes.
4. Leave git to the lead: no commits, stashes, resets, or branch changes.
5. Return status "done" with a summary a reviewer can check against the requirements.`,
  ].filter(Boolean).join('\n\n')
}

function verifyPrompt(stage, impl) {
  return [
    `You are a skeptical verifier for stage ${stage.id} of a plan. Assume the stage is incomplete until the code proves otherwise. Read and run things; edit nothing.`,
    `## Stage ${stage.id}: ${stage.title}\n\n${stage.goal}`,
    `## Requirements to check\n\n${requirementList(stage)}`,
    `## Files the stage owns\n\n${bullets(stage.files)}`,
    `## Verification to run\n\n${stage.verify}`,
    `## The implementer's claim (a claim, not evidence)\n\n${impl.summary}\n\nFiles changed: ${(impl.filesChanged ?? []).join(', ') || 'none listed'}\nAssumptions: ${(impl.assumptions ?? []).join('; ') || 'none'}`,
    `## How to judge

- For each requirement, find the code that satisfies it and cite it as file:line. A requirement without evidence is unmet.
- Run the verification. Other stages may be mid-edit in the same tree, so attribute a failure to this stage only when it traces to the files it owns.
- Read the diff of the owned files (git diff -- <files>) for stubs, TODOs, dead code, swallowed errors, and behaviour the requirements did not ask for.
- pass is true only when every requirement is met and the verification passes. Every problem must be concrete enough to fix without re-investigating.`,
  ].join('\n\n')
}

async function runStage(stage, upstream) {
  let problems = null
  let impl = null
  for (let round = 0; round <= MAX_FIX_ROUNDS; round++) {
    const suffix = round ? ` fix ${round}` : ''
    impl = await agent(implementPrompt(stage, upstream, problems), {
      label: `implement:${stage.id}${suffix}`,
      phase: 'Implement',
      model: stage.model,
      schema: IMPLEMENT_SCHEMA,
    })
    if (!impl) return { id: stage.id, status: 'failed', problems: ['Implementer was skipped or died'] }
    if (impl.status === 'questions') return { id: stage.id, status: 'questions', summary: impl.summary, questions: impl.questions ?? [] }

    const verdict = await agent(verifyPrompt(stage, impl), {
      label: `verify:${stage.id}${suffix}`,
      phase: 'Verify',
      model: 'opus',
      schema: VERIFY_SCHEMA,
    })
    if (verdict?.pass) return { id: stage.id, status: 'done', ...impl, verdict }
    problems = verdict?.problems ?? ['Verifier was skipped or died']
    log(`${stage.id}: verification failed (round ${round + 1}), ${problems.length} problem(s)`)
  }
  return { id: stage.id, status: 'failed', summary: impl.summary, assumptions: impl.assumptions, problems }
}

assertAcyclic()

const runs = {}
const run = id => (runs[id] ??= (async () => {
  if (done[id]) return done[id]
  const stage = byId[id]
  const upstream = await Promise.all((stage.dependsOn ?? []).map(run))
  const blockers = upstream.filter(u => u.status !== 'done').map(u => u.id)
  if (blockers.length) return { id, status: 'waiting', on: blockers }
  return runStage(stage, upstream)
})())

return Promise.all(stages.map(s => run(s.id)))
