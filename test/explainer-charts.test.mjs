import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = path.resolve('archify/bin/archify.mjs');
const draft = chart => `# Why did P99 jump? {#p99}\n\nOnly the slowest requests got slower.\n\n@meta locale=en\n\n## How did the numbers move? {#shift}\n\n\`\`\`mermaid title="Before and after"\n${chart}\n\`\`\`\n`;
function finalize(t, chart) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-explainer-chart-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'draft.md'), output = path.join(dir, 'page.html');
  fs.writeFileSync(input, draft(chart));
  const run = spawnSync(process.execPath, [cli, 'finalize', 'explainer', input, output, '--json'], { encoding: 'utf8', env: { ...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1' } });
  return { status: run.status, receipt: JSON.parse(run.stdout), html: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null };
}

test('explainer chart fences render static themed SVG without shipping the chart library', t => {
  const { status, html } = finalize(t, 'xychart-beta\n  x-axis ["Before", "After"]\n  bar [80, 600]');
  assert.equal(status, 0);
  const figure = html.match(/<figure class="chart"[\s\S]*?<\/figure>/)[0];
  assert.match(figure, /<svg\b[^>]*class="pele pele-xychart"/);
  assert.match(figure, /<figcaption>Before and after<\/figcaption>/);
  assert.doesNotMatch(html, /registerDiagram|PeleError/);
});

test('explainer chart fences send native diagram types to shorthand and locate syntax errors', t => {
  const flow = finalize(t, 'flowchart LR\n  A --> B');
  assert.notEqual(flow.status, 0);
  assert.ok(flow.receipt.diagnostics.some(d => d.code === 'explainer/chart' && /native workflow/.test(d.message) && d.subject.line === 10));
  const broken = finalize(t, 'pie title Share\n  "A" : abc');
  assert.ok(broken.receipt.diagnostics.some(d => d.code === 'explainer/chart' && d.subject.line === 11));
  assert.equal(broken.html, null);
});
