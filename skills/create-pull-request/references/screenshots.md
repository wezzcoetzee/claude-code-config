# Capturing and attaching screenshots

Reached from step 7 of the skill, after every gate there passed. The parts below are lettered so that "step N" always means a step of the skill.

## A. Pick the shots

List the screens and states the diff changes, then pick one shot for each state a reviewer would otherwise have to run the branch to see. Usually that's one to three. Label each one *after*. Also take a *before* when the change alters something that already exists on the base branch. A brand-new screen gets only an *after*.

## B. Capture

Shell variables don't survive between Bash calls, so use a fixed directory outside the repo and spell out its full path in every command:

```bash
mkdir -p "/tmp/pr-shots-$(git rev-parse --short HEAD)" && echo "/tmp/pr-shots-$(git rev-parse --short HEAD)"
```

Start the app from this checkout with the project's own launch skill, or the `run` skill when there isn't one. Use local or seeded data only: the PR is visible to everyone with access to the repo, and attachments outlive the PR. If the change only shows up behind sign-in, a flag or data you can't create locally, skip that shot rather than pointing at a shared environment.

Use whichever browser tool the session has that writes an image file. Without one, use the Playwright CLI:

```bash
bunx playwright install chromium   # first run only
bunx playwright screenshot --viewport-size=1280,800 --full-page http://localhost:3000/path /tmp/pr-shots-<sha>/after-settings.png
```

For *before* shots, check out the PR's base branch (the default branch unless the user named another) in a temporary worktree at a fixed path, then run the same capture against it:

```bash
git fetch origin <base> && git worktree add /tmp/pr-shots-<sha>-base origin/<base>
```

Install its dependencies, capture at the same URL and viewport as the *after*, stop the app, then run `git worktree remove --force /tmp/pr-shots-<sha>-base`. Stop every app you started once the capture is done.

## C. Check every image

Open each file with the Read tool and look at it. Keep it only when all of these hold:

- It shows the change itself, with nothing still loading, no error overlay and no blank page.
- *Before* and *after* frame the same view, so the difference is the change.
- It shows no tokens, keys, emails, names or other real data.

Retake any image that fails, or drop it. A misleading screenshot is worse than none. Use a PNG, JPG or GIF for stills and an MP4 for recordings, and `gh` rejects files it can't attach. If no image survives, go back to step 7 and handle it as a failed gate.

## D. Reference them in the body

`gh pr create --attach` uploads each file. Where the body already references the file's path, it swaps in the uploaded URL, so you decide where each image appears. Reference each file in the template's screenshots section using the exact absolute path you'll pass to `--attach`:

```markdown
## Screenshots / Video

| Before | After |
|---|---|
| ![Settings before](/tmp/pr-shots-1a2b3c4/before-settings.png) | ![Settings after](/tmp/pr-shots-1a2b3c4/after-settings.png) |
```

Drop the *Before* column when there are no *before* shots. Then go back to the skill and create the PR as described in step 8.
