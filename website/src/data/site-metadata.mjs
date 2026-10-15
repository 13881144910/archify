import { canonicalUrl, canonicalOrigin } from './site-urls.mjs';
const descriptions = {
  index: {
    en: ['Archify — Interactive Diagram Skill for AI Coding Agents', 'Create architecture, workflow, and sequence diagrams with Claude Code, Codex, or other coding agents. Archify is an MIT-licensed skill that delivers interactive HTML.'],
    zh: ['Archify — 面向 AI Agent 的交互式画图工具', '用 Claude Code、Codex 等 AI Agent 从自然语言或代码仓库创建架构图、流程图和时序图。Archify 是采用 MIT 许可证的开源画图 Skill，交付可探索、可导出的交互式 HTML。'],
  },
  guide: {
    en: ['Archify Scenario Guide — Choose the Right Diagram', 'Choose an Archify diagram recipe for your question. Browse evidence checklists, use cases, boundaries, and prompts linked to the recipe source.'],
    zh: ['Archify 场景指南 — 选择合适的图表', '从需要解释的问题出发选择图表配方，查看与 Archify 配方源码一致的场景、证据清单、使用边界和可复制提示词。'],
  },
  start: {
    en: ['Archify Start — Create Your First Diagram', 'Install Archify for your AI agent and create a diagram from a description or code. Choose your agent, diagram type, and input to copy a command and prompt.'],
    zh: ['Archify 快速上手 — 创建第一张图', '为你的 AI Agent 安装 Archify 技能，从自然语言或代码仓库创建图表。选择 Agent、图表类型和输入方式，复制对应的命令与提示词。'],
  },
  gallery: {
    en: ['Archify Proof Lab — Validated Diagram Gallery', 'Explore validated Archify diagrams with interactive HTML, JSON sources, and recorded checks. Automated validation and human visual review appear separately.'],
    zh: ['Archify 验证作品集 — 可探索的图表成品', '探索经过验证的 Archify 图表，查看交互式 HTML 成品、对应 JSON 源码与检查记录。自动验证与人工视觉评审分别列出。'],
  },
  community: {
    en: ['Archify Community — Packages Built on Archify', 'Explore independent packages built on Archify: skills, recipes, themes, locales, and CLI wrappers, with source, license, compatibility, and evidence.'],
    zh: ['Archify 社区 — 基于 Archify 的独立包', '浏览基于 Archify 的独立社区包，包括技能、配方、主题、语言包与 CLI 封装，并查看源码、许可证、兼容性和验证证据。'],
  },
};
export function pageMetadata(page, lang, version) {
  const [title, description] = descriptions[page][lang];
  const canonical = canonicalUrl(page, lang);
  return { title, description, canonical, image: `${canonicalOrigin}/assets/archify-social-preview.png`,
    schema: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', '@id': `${canonicalOrigin}/#website`, url: `${canonicalOrigin}/`, name: 'Archify', inLanguage: ['en', 'zh-Hans'] },
      { '@type': 'SoftwareSourceCode', '@id': `${canonicalOrigin}/#source`, name: 'Archify', codeRepository: 'https://github.com/tt-a1i/archify', url: 'https://github.com/tt-a1i/archify', license: 'https://github.com/tt-a1i/archify/blob/main/LICENSE', version, programmingLanguage: 'JavaScript', description: descriptions.index[lang][1] },
    ] },
  };
}
