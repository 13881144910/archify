import { PeleError, detectType, register, render } from './vendor/pele/core.js';
import pie from './vendor/pele/diagrams/pie.js';
import xychart from './vendor/pele/diagrams/xychart.js';
import quadrantChart from './vendor/pele/diagrams/quadrantChart.js';
import sankey from './vendor/pele/diagrams/sankey.js';
import radar from './vendor/pele/diagrams/radar.js';
import venn from './vendor/pele/diagrams/venn.js';

register(pie, xychart, quadrantChart, sankey, radar, venn);

const NATIVE = { flowchart: 'workflow or architecture', sequence: 'sequence', class: 'class', er: 'erd', state: 'lifecycle', timeline: 'timeline', gantt: 'timeline or waterfall', mindmap: 'tree', treeview: 'tree' };

/** Render a Mermaid chart to static SVG, or return a located diagnostic reason. */
export function compileExplainerChart(text) {
  const type = detectType(text);
  if (type && NATIVE[type]) return { error: `Mermaid ${type} is drawn with the native ${NATIVE[type]} shorthand, which Archify validates and lets readers explore.`, example: `@${NATIVE[type].split(' ')[0]} id=...` };
  try {
    const result = render(text, { padding: 8, fontSize: 14, links: false, images: false, config: { xyChart: { width: 520, height: 280 }, quadrantChart: { chartWidth: 420, chartHeight: 420 } } });
    // A rotated CJK axis title lies on its side; vertical writing keeps the characters upright.
    const svg = result.svg.replace(/<g transform="translate\(([\d.-]+),([\d.-]+)\) rotate\(-90\)"><text x="0" y="[\d.-]+" text-anchor="middle">([^<]*\p{Script=Han}[^<]*)<\/text><\/g>/gu, (_, x, y, label) => `<text x="${x}" y="${y}" text-anchor="middle" writing-mode="vertical-rl">${label}</text>`);
    return { svg, width: result.width, height: result.height, type: result.type };
  } catch (error) {
    if (!(error instanceof PeleError)) throw error;
    const supported = 'pie, xychart-beta (bar and line), quadrantChart, sankey-beta, radar-beta or venn-beta';
    return { error: error.code === 'unsupported-diagram' ? `A chart fence supports ${supported}.` : error.message.split('\n')[0], line: error.line, example: 'pie title Share\n  "A" : 60\n  "B" : 40' };
  }
}
