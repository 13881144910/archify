# Architecture case to first use

Base: `ba701d20a55ed6f139484d9ead7ff45671fe40eb` (main, 2026-10-19).
Candidate: the commit containing this receipt. Checks ran on its complete working diff before commit; no product or output changes followed.

## Observed before

The homepage navigation's Install Skill anchor resolved to `#quickstart`, although Start already supports agent and install-scope selection. The architecture type panel linked only to the general gallery. The existing MCO case had pinned evidence and limits but no replay command or direct repository-mode installation action. These are inspection findings, not measured conversion failures.

## Changed experience

- Homepage Install Skill opens localized Start at `#install`.
- The architecture type panel links to the existing localized MCO case.
- The case provides the original HTML and JSON, a replay pinned to both repositories, an adaptation prompt, boundaries and repository-mode Start.
- Original artifact/source bytes and all generation behavior remain unchanged.

## Checks executed by Codex

- `npm --prefix website run check`: 0 errors, 0 warnings, one existing clipboard deprecation hint.
- Default build: 14 pages. `npm --prefix website test`: 79 passed, 7 browser tests skipped by their opt-in conditions, 0 failed.
- Cloudflare build: 14 pages. `ARCHIFY_SITE_TARGET=cloudflare node --test website/test/mco-source-case.test.mjs website/test/seo-content.test.mjs website/test/deployment-target.test.mjs`: 18 passed.
- Existing homepage and MCO real Chrome browser suites: 2 passed, 0 skipped on each host build. Covers English/Chinese, light/dark, widths 1440/390/320, text bounds, section navigation, language continuity, gallery links and artifact load.
- Replay command ran successfully using this Archify base and the existing local MCO checkout containing `9f1a1cf1afdc04d7b5406782b40dfec76d9bc798`, passed as `--repo-root`. It produced `/tmp/archify-mco-replay.html`. The initial probe without `--repo-root` failed as designed; the documented commands now include cloning and pinning that repository. The full network clone commands were not repeated for the replay.
- Ego keyboard checks: focus homepage Install Skill and Enter → `/archify/start.html#install`; focus Chinese homepage MCO link and Enter → `/archify/zh/cases/mco-runtime.html`; case repository-mode action and Enter → Start preserving `type=architecture&input=repository#install`. No installation was executed.
- `git diff --check`: passed.

## Visual evidence

Browser-suite screenshots, inspected by Codex (not human acceptance):

- [Desktop replay, English light, 1440×1000](desktop-replay.png)
- [Mobile replay, Chinese light, 390×1000](mobile-zh-replay.png)
- [Mobile adaptation prompt, English dark, 320×1000](mobile-en-prompt.png)

Screenshots are bounded page tiles; their top may continue a preceding tile. Text remains readable and within the viewport. Full local browser manifests and tiles are in ignored `website/.browser-evidence/{github,cloudflare}/`.

No new tracking was added. Existing Start session events were unchanged. This PR establishes usable links and content, not SEO ranking, traffic growth or installation conversion improvements. Live production acceptance awaits an authorized merge and deployment.
