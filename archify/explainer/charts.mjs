import { PeleError, detectType, register, render } from './vendor/pele/core.js';
import pie from './vendor/pele/diagrams/pie.js';
import xychart from './vendor/pele/diagrams/xychart.js';
import quadrantChart from './vendor/pele/diagrams/quadrantChart.js';
import sankey from './vendor/pele/diagrams/sankey.js';
import radar from './vendor/pele/diagrams/radar.js';
import venn from './vendor/pele/diagrams/venn.js';

register(pie, xychart, quadrantChart, sankey, radar, venn);

const NATIVE = { flowchart: 'workflow or architecture', sequence: 'sequence', class: 'class', er: 'erd', state: 'lifecycle', timeline: 'timeline', gantt: 'timeline or waterfall', mindmap: 'tree', treeview: 'tree' };

// A pie legend reads "Label · value (share%)" rather than Pele's "Label [value]". The labels are
// rewritten before rendering so the legend is laid out for their real width.
function pieLegend(text) {
  if (!/^\s*pie\b/u.test(text)) return text;
  const slice = /^(\s*)"((?:[^"\\]|\\.)*)"\s*:\s*(-?\d+(?:\.\d+)?)\s*$/gmu;
  const total = [...text.matchAll(slice)].reduce((sum, match) => sum + Number(match[3]), 0);
  if (!(total > 0)) return text;
  return text.replace(/^(\s*pie)\s+showData\b/u, '$1').replace(slice, (_, indent, label, value) => { const share = Math.round(Number(value) / total * 100); return `${indent}"${label} · ${value}${/\p{Script=Han}/u.test(label) ? `（${share}%）` : ` (${share}%)`}" : ${value}`; });
}

/** Render a Mermaid chart to static SVG, or return a located diagnostic reason. */
export function compileExplainerChart(text) {
  const type = detectType(text);
  if (type && NATIVE[type]) return { error: `Mermaid ${type} is drawn with the native ${NATIVE[type]} shorthand, which Archify validates and lets readers explore.`, example: `@${NATIVE[type].split(' ')[0]} id=...` };
  try {
    const result = render(pieLegend(text), { padding: 8, fontSize: 13, links: false, images: false, config: { xyChart: { width: 480, height: 260, showDataLabel: true }, quadrantChart: { chartWidth: 400, chartHeight: 400 } } });
    // A rotated CJK axis title lies on its side; vertical writing keeps the characters upright.
    const svg = result.svg.replace(/<g transform="translate\(([\d.-]+),([\d.-]+)\) rotate\(-90\)"><text x="0" y="[\d.-]+" text-anchor="middle">([^<]*\p{Script=Han}[^<]*)<\/text><\/g>/gu, (_, x, y, label) => `<text x="${x}" y="${y}" text-anchor="middle" writing-mode="vertical-rl">${label}</text>`);
    return { svg, width: result.width, height: result.height, type: result.type };
  } catch (error) {
    if (!(error instanceof PeleError)) throw error;
    const supported = 'pie, xychart-beta (bar and line), quadrantChart, sankey-beta, radar-beta or venn-beta';
    return { error: error.code === 'unsupported-diagram' ? `A chart fence supports ${supported}.` : error.message.split('\n')[0], line: error.line, example: 'pie title Share\n  "A" : 60\n  "B" : 40' };
  }
}
