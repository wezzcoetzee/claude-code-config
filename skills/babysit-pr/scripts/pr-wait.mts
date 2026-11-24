/**
 * Wait on a pull request until something needs attention, then print one JSON line and exit.
 *
 *   node pr-wait.mts <pr-number-or-url> [--repo owner/name] [--timeout 30m] [--interval 30s]
 *                   [--settle 10m] [--since <iso>] [--checks-only]
 *
 * Runs under Bun or under Node 22.18+ (which strips the types itself). Only needs `gh`.
 *
 * Every poll is one GraphQL call pinned to the PR's head commit, so a fresh push never reads the
 * previous commit's checks, and a failed `gh` call is an error rather than "nothing pending".
 *
 * Exit codes: 0 green, 1 failing, 2 feedback, 3 timeout, 4 error, 5 stopped (head moved, closed or
 * merged), 6 conflict.
 */
import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const EXIT_CODES = { green: 0, failing: 1, feedback: 2, timeout: 3, error: 4, stopped: 5, conflict: 6 } as const;
type Status = keyof typeof EXIT_CODES;

const MAX_CONSECUTIVE_ERRORS = 3;
const NO_CHECKS_GRACE_MS = 3 * 60_000;
const EXCERPT_LENGTH = 200;

/**
 * Agents post as the user, so the login alone cannot tell an agent's reply from the user's own
 * comment. These markers identify agent output: the `address-pr-comments` reply header and the
 * `code-review` review footer. Anything else from your login counts as you talking to the agent.
 */
const AGENT_MARKERS = /RESPONDING ON BEHALF OF|Reviewed using Hyperion shared code review skill|universal-review:/;

const QUERY = `
query($owner: String!, $repo: String!, $pr: Int!) {
  viewer { login }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      url state headRefOid mergeable
      commits(last: 1) { nodes { commit {
        oid committedDate
        checkSuites(first: 50) { nodes { createdAt } }
        statusCheckRollup { contexts(first: 100) {
          pageInfo { hasNextPage }
          nodes {
            __typename
            ... on CheckRun { name status conclusion detailsUrl isRequired(pullRequestNumber: $pr) }
            ... on StatusContext { context state targetUrl isRequired(pullRequestNumber: $pr) }
          }
        } }
      } } }
      reviewRequests(first: 20) { nodes { requestedReviewer { __typename ... on Bot { login } } } }
      reviewThreads(first: 100) {
        pageInfo { hasNextPage }
        nodes { isResolved comments(last: 10) { nodes { author { login } createdAt path body } } }
      }
      reviews(last: 50) {
        pageInfo { hasPreviousPage }
        nodes { author { __typename login } state submittedAt body commit { oid } }
      }
      comments(last: 50) {
        pageInfo { hasPreviousPage }
        nodes { author { login } createdAt body }
      }
    }
  }
}`;

interface Author {
  login: string;
  __typename?: string;
}

interface CheckRunNode {
  __typename: "CheckRun";
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
  isRequired: boolean;
}

interface StatusContextNode {
  __typename: "StatusContext";
  context: string;
  state: string;
  targetUrl: string | null;
  isRequired: boolean;
}

interface Comment {
  author: Author | null;
  createdAt: string;
  body: string;
}

export interface PullRequestSnapshot {
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  headRefOid: string;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  commits: {
    nodes: {
      commit: {
        oid: string;
        committedDate: string;
        checkSuites: { nodes: { createdAt: string }[] } | null;
        statusCheckRollup: {
          contexts: { pageInfo: { hasNextPage: boolean }; nodes: Array<CheckRunNode | StatusContextNode> };
        } | null;
      };
    }[];
  };
  reviewRequests: { nodes: { requestedReviewer: { __typename: string; login?: string } | null }[] };
  reviewThreads: {
    pageInfo: { hasNextPage: boolean };
    nodes: { isResolved: boolean; comments: { nodes: Array<Comment & { path: string }> } }[];
  };
  reviews: {
    pageInfo: { hasPreviousPage: boolean };
    nodes: { author: Author | null; state: string; submittedAt: string | null; body: string; commit: { oid: string } | null }[];
  };
  comments: { pageInfo: { hasPreviousPage: boolean }; nodes: Comment[] };
}

interface QueryResult {
  data: { viewer: Author; repository: { pullRequest: PullRequestSnapshot | null } };
}

export interface Check {
  name: string;
  outcome: "pass" | "fail" | "pending";
  required: boolean;
  url: string | null;
}

export interface Feedback {
  kind: "thread" | "review" | "comment";
  author: string;
  at: string;
  path?: string;
  excerpt: string;
}

export interface Assessment {
  head: string;
  conflicting: boolean;
  checks: Check[];
  feedback: Feedback[];
  unresolvedThreads: number;
  /** Bots asked to review, or that reviewed an earlier commit of this PR but not the head yet. */
  awaitedBots: string[];
  /** Lists GitHub cut short, so the counts may be incomplete. */
  truncated: string[];
}

const PASSING_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const PASSING_STATES = new Set(["SUCCESS"]);
const PENDING_STATES = new Set(["PENDING", "EXPECTED"]);

export function toCheck(node: CheckRunNode | StatusContextNode): Check {
  if (node.__typename === "CheckRun") {
    const outcome =
      node.status !== "COMPLETED" ? "pending" : PASSING_CONCLUSIONS.has(node.conclusion ?? "") ? "pass" : "fail";
    return { name: node.name, outcome, required: node.isRequired, url: node.detailsUrl };
  }
  const outcome = PENDING_STATES.has(node.state) ? "pending" : PASSING_STATES.has(node.state) ? "pass" : "fail";
  return { name: node.context, outcome, required: node.isRequired, url: node.targetUrl };
}

/**
 * When the head commit reached GitHub. CI suites are created on push, so the earliest one is the
 * push time; a commit made long before it was pushed would otherwise widen the feedback window.
 */
export function pushedAt(pr: PullRequestSnapshot): string | null {
  const commit = pr.commits.nodes[0]?.commit;
  if (!commit) {
    return null;
  }
  const suites = (commit.checkSuites?.nodes ?? []).map((s) => s.createdAt).sort();
  return suites[0] ?? commit.committedDate;
}

const excerpt = (body: string) => body.replace(/\s+/g, " ").trim().slice(0, EXCERPT_LENGTH);

const latest = (times: Array<string | null>, floor: string) =>
  times.reduce<string>((max, at) => (at !== null && at > max ? at : max), floor);

/**
 * Reduce a snapshot to what the caller acts on. Feedback is anything after `since` that is not
 * agent output, minus what the agent has already answered: a thread counts from the agent's last
 * reply in it, and reviews and PR comments from its last top-level reply. Without that, a pushback
 * with no new commit would be reported again on every run.
 */
export function assess(pr: PullRequestSnapshot, since: string, self: string): Assessment {
  const byAgent = (author: Author | null, body: string) => author?.login === self && AGENT_MARKERS.test(body);
  const isFeedback = (author: Author | null, body: string, at: string | null, cutoff: string) =>
    author !== null && at !== null && at > cutoff && !byAgent(author, body);

  const contexts = pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts;
  const unresolved = pr.reviewThreads.nodes.filter((thread) => !thread.isResolved);
  const topLevelCutoff = latest(
    [
      ...pr.reviews.nodes.filter((r) => byAgent(r.author, r.body)).map((r) => r.submittedAt),
      ...pr.comments.nodes.filter((c) => byAgent(c.author, c.body)).map((c) => c.createdAt),
    ],
    since,
  );

  const feedback: Feedback[] = [
    ...unresolved.flatMap((thread) => {
      const cutoff = latest(thread.comments.nodes.filter((c) => byAgent(c.author, c.body)).map((c) => c.createdAt), since);
      return thread.comments.nodes
        .filter((c) => isFeedback(c.author, c.body, c.createdAt, cutoff))
        .map((c): Feedback => ({ kind: "thread", author: c.author!.login, at: c.createdAt, path: c.path, excerpt: excerpt(c.body) }));
    }),
    ...pr.reviews.nodes
      .filter((r) => isFeedback(r.author, r.body, r.submittedAt, topLevelCutoff))
      .filter((r) => r.body.trim() !== "" || r.state === "CHANGES_REQUESTED")
      .map((r): Feedback => ({ kind: "review", author: r.author!.login, at: r.submittedAt!, excerpt: excerpt(`${r.state}: ${r.body}`) })),
    ...pr.comments.nodes
      .filter((c) => isFeedback(c.author, c.body, c.createdAt, topLevelCutoff))
      .map((c): Feedback => ({ kind: "comment", author: c.author!.login, at: c.createdAt, excerpt: excerpt(c.body) })),
  ];

  const botReviews = pr.reviews.nodes.filter((r) => r.author?.__typename === "Bot");
  const reviewedHead = new Set(botReviews.filter((r) => r.commit?.oid === pr.headRefOid).map((r) => r.author!.login));
  const requested = pr.reviewRequests.nodes.flatMap((n) =>
    n.requestedReviewer?.__typename === "Bot" && n.requestedReviewer.login ? [n.requestedReviewer.login] : [],
  );
  const reviewedBefore = botReviews.map((r) => r.author!.login).filter((login) => !reviewedHead.has(login));

  const truncated = [
    contexts?.pageInfo.hasNextPage && "checks",
    pr.reviewThreads.pageInfo.hasNextPage && "reviewThreads",
    pr.reviews.pageInfo.hasPreviousPage && "reviews",
    pr.comments.pageInfo.hasPreviousPage && "comments",
  ].filter((name): name is string => typeof name === "string");

  return {
    head: pr.headRefOid,
    conflicting: pr.mergeable === "CONFLICTING",
    checks: (contexts?.nodes ?? []).map(toCheck),
    feedback,
    unresolvedThreads: unresolved.length,
    awaitedBots: [...new Set([...requested, ...reviewedBefore])],
    truncated,
  };
}

export interface Clock {
  /** No checks have appeared for long enough to treat the repo as having none. */
  noChecksGraceOver: boolean;
  /** Checks have been settled long enough to stop waiting for silent bots. */
  settleOver: boolean;
}

/**
 * Decide whether to stop; `null` means keep waiting. Only required checks count as failing, unless
 * the repo marks none as required, in which case every check does.
 */
export function decide(a: Assessment, checksOnly: boolean, clock: Clock): Status | null {
  if (a.conflicting) {
    return "conflict";
  }
  if (!checksOnly && a.feedback.length > 0) {
    return "feedback";
  }
  const gating = a.checks.some((c) => c.required) ? a.checks.filter((c) => c.required) : a.checks;
  if (gating.some((c) => c.outcome === "fail")) {
    return "failing";
  }
  const checksSettled = a.checks.length > 0 ? a.checks.every((c) => c.outcome !== "pending") : clock.noChecksGraceOver;
  const botsDone = checksOnly || a.awaitedBots.length === 0 || clock.settleOver;
  return checksSettled && botsDone ? "green" : null;
}

/** Whether every check has finished, so the bot settle window can start. */
export const checksSettled = (a: Assessment) => a.checks.every((c) => c.outcome !== "pending");

interface Options {
  pr: string;
  repo?: string;
  timeoutMs: number;
  intervalMs: number;
  settleMs: number;
  since?: string;
  checksOnly: boolean;
}

function parseDuration(value: string): number {
  const match = /^(\d+)(ms|s|m|h)?$/.exec(value);
  if (!match) {
    throw new Error(`invalid duration '${value}' (use e.g. 45s, 30m, 1h)`);
  }
  const unit = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }[match[2] ?? "s"] ?? 1_000;
  return Number(match[1]) * unit;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { pr: "", timeoutMs: 30 * 60_000, intervalMs: 30_000, settleMs: 10 * 60_000, checksOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`${arg} needs a value`);
      }
      return value;
    };
    switch (arg) {
      case "--repo": options.repo = next(); break;
      case "--timeout": options.timeoutMs = parseDuration(next()); break;
      case "--interval": options.intervalMs = Math.max(10_000, parseDuration(next())); break;
      case "--settle": options.settleMs = parseDuration(next()); break;
      case "--since": options.since = new Date(next()).toISOString(); break;
      case "--checks-only": options.checksOnly = true; break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`unknown flag ${arg}`);
        }
        options.pr = arg;
    }
  }
  return options;
}

async function gh(args: string[]): Promise<unknown> {
  const { stdout } = await run("gh", args, { maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function resolvePr(options: Options): Promise<{ owner: string; repo: string; number: number }> {
  const args = ["pr", "view", ...(options.pr ? [options.pr] : []), ...(options.repo ? ["--repo", options.repo] : []), "--json", "url"];
  const { url } = (await gh(args)) as { url: string };
  const match = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url);
  if (!match) {
    throw new Error(`could not parse PR url '${url}'`);
  }
  return { owner: match[1]!, repo: match[2]!, number: Number(match[3]) };
}

async function fetchSnapshot(owner: string, repo: string, pr: number) {
  const result = (await gh(["api", "graphql", "-f", `query=${QUERY}`, "-f", `owner=${owner}`, "-f", `repo=${repo}`, "-F", `pr=${pr}`])) as QueryResult;
  const snapshot = result.data.repository.pullRequest;
  if (!snapshot) {
    throw new Error(`PR ${owner}/${repo}#${pr} not found`);
  }
  return { snapshot, self: result.data.viewer.login };
}

function report(status: Status, fields: Record<string, unknown>): never {
  console.log(JSON.stringify({ status, ...fields }));
  process.exit(EXIT_CODES[status]);
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
    return stderr || error.message;
  }
  return String(error);
}

function summarise(a: Assessment) {
  const named = (outcome: Check["outcome"]) => a.checks.filter((c) => c.outcome === outcome);
  return {
    head: a.head,
    checks: {
      passed: named("pass").length,
      failed: named("fail").map(({ name, required, url }) => ({ name, required, url })),
      pending: named("pending").map((c) => c.name),
    },
    feedback: a.feedback,
    unresolvedThreads: a.unresolvedThreads,
    awaitedBots: a.awaitedBots,
    ...(a.truncated.length > 0 ? { truncated: a.truncated } : {}),
  };
}

async function main() {
  const started = Date.now();
  let options: Options;
  let pr: Awaited<ReturnType<typeof resolvePr>>;
  try {
    options = parseArgs(process.argv.slice(2));
    pr = await resolvePr(options);
  } catch (error: unknown) {
    report("error", { error: describe(error) });
  }

  let watchedHead: string | null = null;
  let since = options.since ?? null;
  let settledSince: number | null = null;
  let last: Assessment | null = null;
  let consecutiveErrors = 0;

  while (true) {
    const now = Date.now();
    const base = { pr: `${pr.owner}/${pr.repo}#${pr.number}`, waitedSec: Math.round((now - started) / 1000) };
    try {
      const { snapshot, self } = await fetchSnapshot(pr.owner, pr.repo, pr.number);
      consecutiveErrors = 0;
      watchedHead ??= snapshot.headRefOid;
      since ??= pushedAt(snapshot) ?? new Date(started).toISOString();

      if (snapshot.state !== "OPEN") {
        report("stopped", { ...base, reason: snapshot.state.toLowerCase(), url: snapshot.url });
      }
      if (snapshot.headRefOid !== watchedHead) {
        report("stopped", { ...base, reason: "head-moved", from: watchedHead, to: snapshot.headRefOid, url: snapshot.url });
      }

      last = assess(snapshot, since, self);
      settledSince = checksSettled(last) ? (settledSince ?? now) : null;
      const status = decide(last, options.checksOnly, {
        noChecksGraceOver: now - started >= NO_CHECKS_GRACE_MS,
        settleOver: settledSince !== null && now - settledSince >= options.settleMs,
      });
      if (status) {
        report(status, { ...base, url: snapshot.url, since, ...summarise(last) });
      }
    } catch (error: unknown) {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        report("error", { ...base, error: describe(error) });
      }
    }

    if (Date.now() - started + options.intervalMs > options.timeoutMs) {
      report("timeout", { ...base, since, ...(last ? summarise(last) : {}) });
    }
    await sleep(options.intervalMs);
  }
}

if (import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
