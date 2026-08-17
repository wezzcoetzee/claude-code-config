I'm Wesley, you're my agent. We'll be working on various different proejcts in the future so it's best you know things about me.

I love to build. I love to take complex problems and find the most simple solution for them. I'm also very inquisitive, I love exploring new ways to solve problems.

I wanted to share my preferences with you, so when we're working together we're well aligned and it should create less friction.

## Coding Preferences - General

- Keep things simple, always make use of principles like YAGNI and KISS.
- Repetition is your worst enemy with code, remember to use DRY so that code bases don't sprawl.
- Typesafety is great, always use it when you can.
- Don't be scared to propose bold or out of the ordinary ideas if you think they are a genuinely better solution that should be explored.
- Becareful of destructive actions that aren't explicitly requested by the user
- Tests are great, and having them is super useful. But having an endless test suite that is testing dead features, smoke tests, etc. isn't useful. Be intentional when adding tests
- Adding comments to code is a great way to let a user understand a complex implementation, but code for the most part should describe itself. Make sure you don't comment every line just to say you did it.
- When you're updating code, make sure documentation and comments are kept up to date. The next agent that comes into the code will appreciate it.
- Write your code in a way that you are proud of.

## Coding Preferences - TypeScript

- `any` is your enemy, inferred types are your friend. Our system should adapt to changes, instead of requireing changes everywhere.
- If you TypeScript code looks like a Python develoepr wrote it, it's bad TypeScript code.
- Avoid one-line functinos that are just casting wrappers
- If not specified in the project, I genereally like to use the following technology: Postgress, Tailwind, NextJs, Bun, ShadCN
- When building more complex systems, I like to use things like Prisma, Zustand, Tanstack Query, Zod.

## Questions are readonly

- A question is a request for an answer, not for changes. If the messages opens with "how hard would it be", "what are your thoughts", "why does", "should we", "is it possible", "can X do Y", or otherise asks rather than instructs; answer it and do not make changes
- If the answer is obvious and the changes are trivial, still only answer first and offer to make changes.

## Match ceremony to the task

- Do not spawn subagents oor multi-agent panel for work a single agent finishes in one pass. Delegation is for breadth and adversarial review, not for ordinary tasks.
- When serveral agents do work in parallel, state file ownership up front so they don't collide

## Visual and design work

- Do not edit real components first. For any non-trivial UI, layout, or copy change, build several distinct static mocks, public them with the `html-communication` skill, report the URL and stop. Wait for a pick before implementing.
- Standing constracints: dark mode, true black (#000) background, white primary text. Information-dense, no decorative card/pill chrome, no light-gray subtitle lines above sections. Minimal copy. No em dashes.
- Avoid continuously repainting CSS animations (pulse, shimmer, blur, spinners); they peg the GPU on high-refresh displays.

## Blast radius

- Never touch production, live databases, or daily-driver build/preview channels unless explicitly told t. When a task is adjacent to any of them, name what you are about to touch before touching it.

## Pull Requests

- Make sure titles follow conventions from the repo. They should be simple and easy to understand. Conventional commit styles in projects that use them, i.e "fix(web): actions not have confirmations"
- PR descriptions should aim for simplicity. Open with a minimal, clear description of the project. Follow up with how you solved it.
- Adding a mermaid diagram to help explain the change is always a good idea.
- Add a blurb to the end of the PR description about what model and harness is making the changes
- *Open a real PR, not a draft*. Drafts don't get reviewed by bots
- *Rebase onto the latest main before opening*. Stale branches conflicts and waste review rounds.
- When asked to monitor or babysit a PR: poll checks and comments newer than the last push; verify each bot finding against the source before acting on it; fix real ones and dismiss false positives with a written reason; fix ci failures, distringuiding real breaks from known infra flakes. If nothing is new, stay quiet - do not post filler comments. Stop when the repo's review bots are green on the last commit
- Merge only per the disposition given in the request (merge when green, or stop and report). if none was given, report and ask.
