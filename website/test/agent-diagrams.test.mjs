import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'parse5';
import { parseSitemap } from '../scripts/indexnow.mjs';

const cloudflare = process.env.ARCHIFY_SITE_TARGET === 'cloudflare';
const output = new URL(cloudflare ? '../dist-cloudflare/' : '../dist/', import.meta.url);
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');

test('agent guide is readable without JavaScript, honest about examples, and linked from both entry points', () => {
  for (const lang of ['en', 'zh']) {
    const prefix = lang === 'zh' ? 'zh/' : '';
    const all = nodes(parse(fs.readFileSync(new URL(`${prefix}agent-diagrams.html`, output), 'utf8')));
    const documentUrl = new URL(`${prefix}agent-diagrams${cloudflare ? '' : '.html'}`, cloudflare ? 'https://archify.si/' : 'https://tt-a1i.github.io/archify/');
    const baseUri = new URL(attr(all.find(node => node.tagName === 'base'), 'href'), documentUrl);
    const article = all.find(node => node.tagName === 'article');
    assert.ok(article);
    assert.equal(nodes(article).filter(node => node.tagName === 'h1').length, 1);
    assert.equal(nodes(article).filter(node => node.tagName === 'blockquote').length, 2);
    const visible = text(article);
    assert.match(visible, lang === 'en' ? /two separate sequence diagrams/i : /分别画两张时序图/);
    assert.match(visible, lang === 'en' ? /not the output of this prompt/ : /不是上述提示词的生成结果/);
    assert.match(text(all.find(node => node.tagName === 'main')), lang === 'en' ? /not recorded agent runs/ : /并非 Agent 实测记录/);
    for (const name of ['Claude Code', 'Codex', 'Cursor', 'OpenCode', 'GitHub Copilot']) assert.ok(visible.includes(name));
    const schema = JSON.parse(text(all.find(node => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json')));
    const structuredArticle = schema['@graph'].find(item => item['@type'] === 'TechArticle');
    assert.equal(structuredArticle.url, `https://archify.si/${prefix}agent-diagrams`);
    assert.equal(structuredArticle.inLanguage, lang === 'zh' ? 'zh-Hans' : 'en');
    const ids = new Set(all.map(node => attr(node, 'id')).filter(Boolean));
    for (const id of ['responsibilities', 'setup', 'cache-scenarios', 'repository-evidence', 'review-and-share', 'questions']) assert.ok(ids.has(id), `${lang}: stable cross-language section ${id}`);
    const toc = all.find(node => attr(node, 'class') === 'article-toc');
    for (const link of nodes(toc).filter(node => node.tagName === 'a')) {
      const destination = new URL(attr(link, 'href'), baseUri);
      assert.equal(destination.origin + destination.pathname, documentUrl.origin + documentUrl.pathname, 'TOC fragments resolve on this page, not the root base');
      const id = decodeURIComponent(destination.hash.slice(1));
      const anchors = nodes(article).filter(node => attr(node, 'id') === id);
      assert.equal(anchors.length, 1, `unique article anchor: ${id}`);
      const anchor = anchors[0];
      // Markdown wraps a standalone inline span in a paragraph.
      const boundary = anchor.parentNode.tagName === 'p' ? anchor.parentNode : anchor;
      const siblings = boundary.parentNode.childNodes;
      const nextElement = siblings.slice(siblings.indexOf(boundary) + 1).find(node => node.tagName);
      assert.equal(nextElement?.tagName, 'h2', `${id}: anchor immediately precedes its section heading`);
      assert.equal(text(nextElement), text(link), `${id}: TOC label must identify the section it reaches, including after reordering`);
    }
    assert.doesNotMatch(visible, /editorial draft|publication checks|workspace\/shared|factcheck\.md/i);
    for (const entry of ['start', 'guide']) {
      const entryNodes = nodes(parse(fs.readFileSync(new URL(`${prefix}${entry}.html`, output), 'utf8')));
      const guideLink = entryNodes.find(node => node.tagName === 'a' && attr(node, 'href') === `${prefix}agent-diagrams${cloudflare ? '' : '.html'}`);
      assert.ok(guideLink, `${prefix}${entry}: contextual discovery`);
      assert.equal(attr(guideLink.parentNode, 'aria-label'), lang === 'zh' ? 'Agent 画图指南' : 'Agent diagramming guide');
    }
  }
});

test('both agent guide routes are included in the actual sitemap and allowed IndexNow inventory', () => {
  const urls = parseSitemap(fs.readFileSync(new URL('sitemap.xml', output), 'utf8'));
  for (const url of ['https://archify.si/agent-diagrams', 'https://archify.si/zh/agent-diagrams']) assert.ok(urls.includes(url));
});
