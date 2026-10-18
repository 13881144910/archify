(() => {
  'use strict';
  const root = document.documentElement;
  const read = id => JSON.parse(document.getElementById(id).textContent);
  const prepared = read('archify-explainer-prepared');
  const diagrams = prepared.preparedDiagrams.diagrams || prepared.preparedDiagrams;
  const words = read('explainer-reader-words');
  const english = root.lang.startsWith('en');
  const say = (en,zh) => english ? en : zh;
  const byId = id => document.getElementById(id);
  const all = (selector, within = document) => [...within.querySelectorAll(selector)];
  let toastTimer;
  function notify(text) { const toast=byId('toast');toast.textContent=text;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),3000); }
  // Measured board layout. Each panel is measured at every column width, then each column template is
  // simulated and the one with the least page height and blank area wins. Panels keep source order on
  // a 1px row grid, so the DOM and reading order never change.
  // Without JavaScript, or on narrow windows, the static spans from the renderer stay in force.
  const board = document.querySelector('.board');
  function layoutBoard() {
    const panels = all(':scope>.panel',board);
    const reset = () => { board.classList.remove('measured'); panels.forEach(panel=>{panel.style.gridColumn = '';panel.style.gridRow = '';}); };
    if (window.innerWidth <= 760 || panels.length < 2) { reset(); return; }
    const gap = parseFloat(getComputedStyle(board).columnGap) || 0;
    const column = (board.clientWidth - gap * 11) / 12;
    const px = span => span * column + (span - 1) * gap;
    const floor = textFloor();
    // A diagram needs enough width for its smallest label to reach the reading floor.
    const readableSpan = panel => {
      const svgs = all('.diagram-preview>svg',panel);
      if (!svgs.length) return 0;
      const inset = panel.offsetWidth - panel.querySelector('.diagram-preview').clientWidth;
      const need = Math.max(...svgs.map(svg=>{
        const viewWidth = svg.viewBox.baseVal?.width || svg.getBoundingClientRect().width;
        const smallest = Math.min(...all('text',svg).filter(text=>text.textContent.trim() && !text.closest('[data-legend]')).map(text=>(parseFloat(text.getAttribute('font-size')) || parseFloat(getComputedStyle(text).fontSize)) / secondary(text)));
        return Number.isFinite(smallest) && smallest > 0 ? viewWidth * floor / smallest + inset : 0;
      }));
      return [3,4,5,6,7,8,9,12].find(span=>px(span) >= need) || 12;
    };
    const SPANS = [4,5,6,7,8,12];
    board.classList.add('measuring');
    const items = panels.map(panel=>{
      const fixed = Number(panel.dataset.spanFixed) || 0;
      const wide = fixed >= 9 || Number((panel.className.match(/\bspan(\d+)\b/) || [])[1]) >= 9;
      const min = Math.max(4,Number(panel.dataset.spanMin) || 4,fixed && fixed < 9 ? fixed : 0,readableSpan(panel));
      const height = {}, fits = {};
      for (const span of SPANS) {
        panel.style.width = px(span) + 'px';
        height[span] = Math.ceil(panel.getBoundingClientRect().height);
        fits[span] = span >= min && !all('.table-scroll,.diff-scroll,pre',panel).some(element=>element.scrollWidth > element.clientWidth + 1);
      }
      panel.style.width = '';
      return {panel,wide,height,fits,text:panel.dataset.measure === 'text'};
    });
    board.classList.remove('measuring');
    const width = board.clientWidth;
    const excess = (item,span) => item.text ? Math.max(0,px(span) - 720) / 720 * px(span) * item.height[span] * .6 : 0;
    // One set of column lines per section. Panels fill the shortest fitting column in source
    // order; a panel that fits no column takes the full width and closes the section above it. The
    // last panel of every column stretches to the section bottom, so column edges and bottoms align.
    function simulate(template, section, forced = []) {
      const lines = template.reduce((acc,span)=>[...acc,acc[acc.length - 1] + span],[1]);
      const placed = [], options = [], chosen = [];
      let cursor = 0, waste = 0, wide = 0, heights, last, previous;
      const open = () => { heights = template.map(()=>0); last = template.map(()=>null); previous = {top:0,c:-1,height:0}; };
      // heights[c] is the offset of the next panel in column c, so it includes one trailing gap.
      const close = () => {
        // A conclusion alone in its section takes the full width rather than leaving blank columns beside it.
        const alone = last.filter(Boolean);
        if (alone.length === 1 && alone[0] === placed[0] && placed.length === 1 && template.length > 1) {
          Object.assign(alone[0],{line:1,span:12,height:alone[0].item.height[12]});
          cursor += alone[0].height + gap;
          open();
          return;
        }
        const bottom = Math.max(...heights) - gap;
        if (bottom <= 0) return;
        template.forEach((span,c)=>{
          waste += px(span) * (heights[c] ? bottom - (heights[c] - gap) : bottom * 1.6);
          if (last[c]) last[c].height = cursor + bottom - last[c].top;
        });
        cursor += bottom + gap;
        open();
      };
      open();
      for (const [index,item] of section.entries()) {
        const answer = item.panel.id === 'answer' && item === items[0];
        const choices = template.map((span,c)=>({c,span})).filter(({c,span})=>template.length > 1 && !item.wide && item.fits[span] && (!answer || c === 0));
        options.push(choices.length);
        if (!choices.length) {
          chosen.push(0);
          close();
          placed.push({item,line:1,span:12,top:cursor,height:item.height[12]});
          wide += excess(item,12);
          cursor += item.height[12] + gap;
          continue;
        }
        // Reading order is top to bottom, then left to right: a panel never starts above the previous
        // one, and starts clearly lower when placed to its left. The panel above it stretches to close the gap.
        const start = c => Math.max(heights[c], c < previous.c ? previous.top + Math.min(160, previous.height / 2) : previous.top);
        const bottom = ({c,span}) => start(c) + item.height[span];
        const selected = choices[forced[index]] || choices.reduce((a,b)=>bottom(b) < bottom(a) - 1 ? b : a), {c,span} = selected;
        chosen.push(choices.indexOf(selected));
        const top = start(c);
        // A gap with no panel above it to stretch is a visible hole, which reads worse than room inside a card.
        if (top > heights[c]) { waste += px(span) * (top - heights[c]) * (last[c] ? 1 : 1.6); if (last[c]) last[c].height += top - heights[c]; }
        const entry = {item,line:lines[c],span,top:cursor + top,height:item.height[span]};
        placed.push(entry);
        previous = {top,c,height:item.height[span]};
        heights[c] = top + item.height[span] + gap;
        last[c] = entry;
        wide += excess(item,span);
      }
      close();
      return {placed,options,chosen,height:cursor,cost:cursor * width + waste + wide};
    }
    // Greedy placement cannot see that a short fit now forces a hole later, so each panel's column is
    // chosen by completing the rest of the section greedily for every option and keeping the cheapest.
    function plan(template, section) {
      let best = simulate(template,section);
      for (let index = 0; index < section.length; index++) {
        const prefix = best.chosen.slice(0,index);
        for (let option = 0; option < best.options[index]; option++) {
          const trial = simulate(template,section,[...prefix,option]);
          if (trial.cost < best.cost - 1) best = trial;
        }
      }
      return best;
    }
    // Full-width panels split the page into sections; each section picks its own column lines.
    const templates = [[6,6],[5,7],[7,5],[4,8],[8,4],[4,4,4],[12]];
    const sections = items.reduce((list,item)=>{ if (item.wide || list.at(-1)?.[0]?.wide) list.push([item]); else list.at(-1).push(item); return list; },[[]]).filter(section=>section.length);
    let offset = 0;
    for (const section of sections) {
      const layout = templates.map(template=>plan(template,section)).reduce((a,b)=>b.cost < a.cost ? b : a);
      layout.placed.forEach(({item,line,span,top,height})=>{
        item.panel.style.gridColumn = `${line} / span ${span}`;
        item.panel.style.gridRow = `${Math.round(offset + top) + 1} / span ${Math.max(1,Math.round(height))}`;
      });
      offset += layout.height;
    }
    board.classList.add('measured');
  }
  // Phase rows that step down share one lane width, which leaves a wide empty strip beside each row.
  // In the preview each lane frame hugs its own nodes; the full Viewer keeps the native geometry.
  function fitLaneFrames(svg) {
    if (svg.closest('.bare-lanes')) return;
    const frames = all('rect[data-composition-frame-kind="lane"]',svg);
    if (frames.length < 2) return;
    const nodes = all('[data-node-id]',svg).map(node=>node.getBBox());
    frames.forEach(frame=>{
      const y = frame.y.baseVal.value, bottom = y + frame.height.baseVal.value, label = frame.nextElementSibling?.tagName === 'text' ? frame.nextElementSibling : null;
      const inside = nodes.filter(box=>box.y >= y && box.y + box.height <= bottom);
      if (!inside.length) return;
      const pad = 16, left = Math.min(...inside.map(box=>box.x)) - pad, right = Math.max(...inside.map(box=>box.x + box.width)) + pad;
      const width = Math.max(right - left, (label?.getComputedTextLength() || 0) + 28);
      frame.setAttribute('x',left); frame.setAttribute('width',width);
      label?.setAttribute('x',left + 14);
    });
  }
  // The legend and grid are hidden in the preview, so fit the viewBox to the drawing itself.
  function cropDiagramPreviews() {
    all('.diagram-preview>svg').forEach(svg=>{
      if (svg.dataset.cropped) return;
      fitLaneFrames(svg);
      let box; try { box = svg.getBBox(); } catch { return; }
      if (!box.width || !box.height) return;
      const pad = 6;
      svg.setAttribute('viewBox',[box.x - pad,box.y - pad,box.width + pad * 2,box.height + pad * 2].map(n=>Math.round(n)).join(' '));
      svg.parentElement.style.setProperty('--native-width',Math.round(box.width + pad * 2) + 'px');
      svg.dataset.cropped = 'true';
    });
  }
  // Edge labels are secondary to node text and may sit a little below the reading floor.
  const secondary = text => text.closest('[data-edge-id]') ? .7 : 1;
  function textFloor() {
    const bodySize = parseFloat(getComputedStyle(document.querySelector('.block-prose>p') || document.body).fontSize);
    return window.innerWidth >= 1440 ? Math.max(10,bodySize * .75) : 10;
  }
  function ensureDiagramReadability() {
    const minimumText = textFloor();
    all('.diagram-preview>svg').forEach(svg=>{
      // Measure the current available width, rather than retaining a wider viewport's floor.
      svg.style.minWidth = '0px';
      const sizes = all('text',svg).filter(text=>text.textContent.trim() && text.getBoundingClientRect().width > 0).map(text=>{const matrix = text.getScreenCTM();return matrix ? parseFloat(getComputedStyle(text).fontSize) / secondary(text) * (()=>{const trace=matrix.a**2+matrix.b**2+matrix.c**2+matrix.d**2;const determinant=matrix.a*matrix.d-matrix.b*matrix.c;return Math.sqrt(Math.max(0,(trace-Math.sqrt(Math.max(0,trace**2-4*determinant**2)))/2));})() : Infinity;});
      const smallest = Math.min(...sizes);
      const preview = svg.parentElement;
      const needed = svg.getBoundingClientRect().width * minimumText / smallest;
      const widened = smallest > 0 && smallest < minimumText && needed <= preview.clientWidth;
      if (widened) preview.style.setProperty('--native-width',Math.ceil(needed / 1.25) + 'px');
      const insufficient = smallest > 0 && smallest < minimumText && !widened;
      if (insufficient) {
        preview.dataset.diagramRequiredWidth = String(Math.ceil(svg.getBoundingClientRect().width * minimumText / smallest));
      } else delete preview.dataset.diagramRequiredWidth;
      preview.dataset.diagramFit = insufficient ? 'insufficient' : 'fit';
      preview.dataset.diagramMinimumText = String(minimumText);
      const status = svg.closest('.block-diagram').querySelector('.diagram-fit-status');
      status.hidden = !insufficient;
      status.textContent = insufficient ? say('This diagram cannot fit this page width with readable text. Open the full diagram to inspect it.','此图无法在当前页宽内同时完整展示并保持文字清晰。请展开交互图查看。') : '';
    });
  }
  const preference = matchMedia('(prefers-color-scheme: dark)');
  let theme = 'auto';
  function applyTheme() {
    const effective = theme === 'auto' ? preference.matches ? 'dark' : 'light' : theme;
    root.dataset.theme = effective;
    all('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice === theme)));
    all('.diagram-preview').forEach(preview=>preview.dataset.theme = effective);
    if (viewer?.ready) sendViewer();
  }
  all('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{theme = button.dataset.themeChoice; applyTheme();}));
  preference.addEventListener?.('change',applyTheme);
  document.querySelector('[data-print]').addEventListener('click',()=>window.print());
  // Long image: the page as laid out now, drawn through an SVG foreignObject at twice the pixel
  // density. Controls, dialogs and walk-through bars are left out. Browsers that refuse to export a
  // foreignObject canvas (Safari) get a notice pointing to Print / PDF.
  async function pageImage() {
    const shell = document.querySelector('.shell'), width = document.documentElement.clientWidth, height = Math.ceil(shell.getBoundingClientRect().height + 48);
    const clone = root.cloneNode(true);
    clone.querySelectorAll('script,dialog,#toast,.skip-link,.tools,.ask-button,.ask-floating,.walk-bar,.walk-start,.interactive,.diagram-fit-status').forEach(element=>element.remove());
    clone.querySelectorAll('.reader-highlight').forEach(element=>element.classList.remove('reader-highlight'));
    clone.querySelectorAll('.focusing').forEach(element=>element.classList.remove('focusing'));
    clone.style.width = `${width}px`;
    const xhtml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">${xhtml}</foreignObject></svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const scale = Math.min(2,16000 / height), canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = getComputedStyle(document.body).backgroundColor; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('empty')),'image/png'));
  }
  const imageButton = document.querySelector('[data-export-image]');
  imageButton?.addEventListener('click',async()=>{
    imageButton.disabled = true;
    try {
      const blob = await pageImage(), link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = `${(document.querySelector('h1')?.textContent || 'explainer').trim().replace(/[\\/:*?"<>|]+/g,' ').slice(0,80)}.png`;
      document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(link.href),4000);
    } catch { notify(say('This browser cannot export the page as an image. Use Print / PDF instead.','当前浏览器无法导出长图，请用"打印 / PDF"。')); }
    finally { imageButton.disabled = false; }
  });
  window.ArchifyExplainer = {pageImage};
  // Only the isolated srcdoc copy receives this bridge. The payload remains byte-for-byte native.
  const viewerDialog = byId('diagram-dialog');
  let viewer = null;
  let viewerOpener;
  function validHash(diagram,hash) {
    if(!hash) return true;
    const nodes = new Set((diagram.semantic?.nodes || []).map(node=>node.id));
    try {
      if(hash.startsWith('focus=')) return nodes.has(decodeURIComponent(hash.slice(6)));
      if(hash.startsWith('route=')) { const parts = hash.slice(6).split('~').map(decodeURIComponent); return parts.length === 2 && parts.every(id=>nodes.has(id)); }
    } catch {}
    return false;
  }
  function sendViewer() { if(!viewer?.ready) return; viewer.frame.contentWindow.postMessage({kind:'archify-explainer-host',token:viewer.token,theme:root.dataset.theme,hash:viewer.hash,nodes:viewer.nodes,edges:viewer.edges},'*'); }
  function openViewer(id,hash,opener) {
    const diagram = diagrams[id];
    if(!diagram || !validHash(diagram,hash)) { notify(say('Diagram target unavailable.','图中目标不可用。')); return; }
    let requestedEdges = []; try { requestedEdges = JSON.parse(opener.dataset.diagramEdges || '[]'); } catch {}
    requestedEdges = requestedEdges.filter(id=>(diagram.semantic?.edges || []).some(edge=>edge.id === id));
    const selectedEdges = (diagram.semantic?.edges || []).filter(edge=>requestedEdges.includes(edge.id));
    const requestedNodes = [...new Set(hash.startsWith('focus=') ? [decodeURIComponent(hash.slice(6))] : hash.startsWith('route=') ? hash.slice(6).split('~').map(decodeURIComponent) : selectedEdges.flatMap(edge=>[edge.from,edge.to]))];
    viewerOpener = opener;
    byId('diagram-dialog-title').textContent = byId(id).querySelector('figcaption span').textContent;
    viewerDialog.showModal(); document.body.classList.add('dialog-open');
    if(viewer?.id === id) { viewer.hash = hash; viewer.nodes = requestedNodes; viewer.edges = requestedEdges; sendViewer(); return; }
    viewer?.frame.remove();
    const token = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
    viewerDialog.dataset.nativeReady = 'false'; delete viewerDialog.dataset.nativeFocus;
    const frame = document.createElement('iframe'); frame.addEventListener('load',()=>{viewerDialog.dataset.nativeLoaded = id;}); frame.title = byId('diagram-dialog-title').textContent;
    frame.setAttribute('sandbox','allow-scripts allow-downloads allow-modals');
    const script = `<script>(()=>{
      const token=${JSON.stringify(token)};
      let pending=null;
      const settle=data=>requestAnimationFrame(()=>{
        if(pending!==data)return;
        if(Array.isArray(data.edges)&&data.edges.length&&Array.isArray(data.nodes)){
          if(window.Archify?.focus?.setMany)window.Archify.focus.setMany(data.nodes,{toggle:false,mode:'selection',updateUrl:false});
          document.querySelectorAll('[data-edge-id]').forEach(edge=>{if(data.edges.includes(edge.dataset.edgeId))edge.setAttribute('data-focus-match','');else edge.removeAttribute('data-focus-match');});
        }
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(pending!==data)return;
          pending=null;
          const active=document.querySelector('svg[data-focus-active]');
          const selected=Array.from(document.querySelectorAll('[data-focus-selected]')).map(node=>node.dataset.nodeId);
          const matched=Array.from(document.querySelectorAll('[data-edge-id][data-focus-match]')).map(edge=>edge.dataset.edgeId);
          parent.postMessage({kind:'archify-explainer-focus-result',token,nodes:[...new Set(selected)],edges:[...new Set(matched)],active:active?.dataset.focusActive||''},'*');
        }));
      });
      // The native hash listeners restore focus before the explicit host selection.
      addEventListener('hashchange',()=>{if(pending&&location.hash.slice(1)===pending.hash)settle(pending);});
      addEventListener('message',event=>{
        const data=event.data;
        if(event.source!==parent||data?.kind!=='archify-explainer-host'||data.token!==token)return;
        if(['light','dark'].includes(data.theme))document.documentElement.dataset.theme=data.theme;
        if(typeof data.hash!=='string'||!/^(?:|focus=[^&]+|route=[^&]+~[^&]+)$/.test(data.hash))return;
        pending=data;
        if(location.hash.slice(1)===data.hash)dispatchEvent(new HashChangeEvent('hashchange'));
        else location.hash=data.hash;
      });
      addEventListener('keydown',event=>{if(event.key==='Escape')parent.postMessage({kind:'archify-explainer-escape',token},'*');},true);
      const ready=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>parent.postMessage({kind:'archify-explainer-ready',token},'*')));
      if(document.readyState==='complete')ready();else addEventListener('load',ready,{once:true});
    })();<\/script>`;
    viewer = {id,frame,token,hash,nodes:requestedNodes,edges:requestedEdges,ready:false};
    viewerDialog.querySelector('.dialog-loading').hidden = false;
    viewerDialog.append(frame);
    nativeHtml(diagram).then(html=>{
      if (viewer?.frame !== frame) return;
      const end = html.toLowerCase().lastIndexOf('</body>');
      frame.srcdoc = end < 0 ? html + script : html.slice(0,end) + script + html.slice(end);
    },()=>notify(say('This diagram could not be opened.','无法打开此交互图。')));
  }
  // The page stores each native Viewer gzip-compressed; inflate it once, on first open.
  function nativeHtml(diagram) {
    if (typeof diagram.html === 'string') return Promise.resolve(diagram.html);
    const bytes = Uint8Array.from(atob(diagram.htmlGzip),character=>character.charCodeAt(0));
    return diagram.inflating ||= new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  function closeViewer() { if(viewerDialog.open) viewerDialog.close(); }
  document.querySelector('[data-close-diagram]').addEventListener('click',closeViewer);
  viewerDialog.addEventListener('close',()=>{ document.body.classList.remove('dialog-open'); viewerOpener?.focus({preventScroll:true}); });
  window.addEventListener('message',event=>{ if(!viewer || event.source !== viewer.frame.contentWindow || event.data?.token !== viewer.token) return; if(event.data.kind === 'archify-explainer-ready') {viewer.ready = true; viewerDialog.dataset.nativeReady = 'true'; viewerDialog.querySelector('.dialog-loading').hidden = true; sendViewer();} else if(event.data.kind === 'archify-explainer-focus-result') {viewerDialog.dataset.nativeFocus = JSON.stringify({nodes:event.data.nodes,edges:event.data.edges,active:event.data.active});} else if(event.data.kind === 'archify-explainer-escape') closeViewer(); });
  all('[data-open-diagram]').forEach(button=>button.addEventListener('click',()=>openViewer(button.dataset.openDiagram,'',button)));
  // One spotlight for every text-to-diagram link: the named nodes and edges stay lit, the rest dims.
  const previewOf = id => byId(id)?.querySelector('.diagram-preview');
  function spotlight(preview, nodes = [], edges = []) {
    if (!preview) return;
    let matched = false;
    all('[data-node-id],[data-edge-id]',preview).forEach(element=>{const hit = nodes.includes(element.dataset.nodeId) || edges.includes(element.dataset.edgeId); matched ||= hit; element.classList.toggle('reader-highlight',hit);});
    preview.classList.toggle('focusing',matched);
  }
  const targetOf = link => {
    const hash = link.dataset.diagramHash || '';
    let edges = []; try { edges = JSON.parse(link.dataset.diagramEdges || '[]'); } catch {}
    return {preview:previewOf(link.dataset.diagramLink),nodes:hash.startsWith('focus=') ? [decodeURIComponent(hash.slice(6))] : hash.startsWith('route=') ? hash.slice(6).split('~').map(decodeURIComponent) : [],edges};
  };
  all('[data-diagram-link]').forEach(link=>{
    link.addEventListener('click',event=>{ event.preventDefault(); openViewer(link.dataset.diagramLink,link.dataset.diagramHash || '',link); });
    const highlight = active => { const {preview,nodes,edges} = targetOf(link); spotlight(preview,active ? nodes : [],active ? edges : []); };
    link.addEventListener('mouseenter',()=>highlight(true)); link.addEventListener('mouseleave',()=>highlight(false)); link.addEventListener('focus',()=>highlight(true)); link.addEventListener('blur',()=>highlight(false));
  });
  // A name in the text that is also a node label is linked to that node, once per panel, both ways:
  // hovering the word lights the node, hovering the node lights the word.
  function linkTerms() {
    const terms = new Map();
    all('.diagram-preview').forEach(preview=>all('[data-node-id][data-node-label]',preview).forEach(node=>{
      const label = node.dataset.nodeLabel.trim();
      const target = {diagram:preview.closest('.block').id,node:node.dataset.nodeId};
      if ((/\p{Script=Han}/u.test(label) ? label.length >= 2 : label.length >= 3) && !terms.has(label.toLowerCase())) terms.set(label.toLowerCase(),target);
      // A plain-word ID ("server" for "Server :443") also names the node in English prose.
      if (/^[a-z]{3,}$/.test(target.node) && !terms.has(target.node)) terms.set(target.node,target);
    }));
    if (!terms.size) return;
    const pattern = new RegExp([...terms.keys()].sort((a,b)=>b.length - a.length).map(label=>label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
      .join('|'),'giu');
    const word = /[\p{L}\p{N}_]/u;
    all('.panel').forEach(panel=>{
      const seen = new Set();
      const walker = document.createTreeWalker(panel.querySelector('.panel-body') || panel,NodeFilter.SHOW_TEXT,{acceptNode:text=>text.parentElement.closest('.block-diagram,.block-chart,pre,code,a,button,svg,figcaption,.term,.diagram-semantics,thead') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
      const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
      for (const text of texts) {
        const value = text.nodeValue, parts = []; let last = 0;
        for (const match of value.matchAll(pattern)) {
          const before = value[match.index - 1], after = value[match.index + match[0].length];
          if (seen.has(match[0].toLowerCase()) || (!/\p{Script=Han}/u.test(match[0]) && ((before && word.test(before)) || (after && word.test(after))))) continue;
          seen.add(match[0].toLowerCase()); parts.push(value.slice(last,match.index),match[0]); last = match.index + match[0].length;
        }
        if (!parts.length) continue;
        const fragment = document.createDocumentFragment();
        parts.forEach((part,index)=>{ if (index % 2 === 0) { fragment.append(part); return; } const target = terms.get(part.toLowerCase()), span = document.createElement('span'); span.className = 'term'; span.dataset.diagram = target.diagram; span.dataset.node = target.node; span.textContent = part; fragment.append(span); });
        fragment.append(value.slice(last)); text.replaceWith(fragment);
      }
    });
    all('.term').forEach(term=>{ const lit = on => spotlight(previewOf(term.dataset.diagram),on ? [term.dataset.node] : []); term.addEventListener('mouseenter',()=>lit(true)); term.addEventListener('mouseleave',()=>lit(false)); });
    all('.diagram-preview').forEach(preview=>{
      const id = preview.closest('.block').id;
      preview.addEventListener('mouseover',event=>{ const node = event.target.closest('[data-node-id]')?.dataset.nodeId; all('.term').forEach(term=>term.classList.toggle('term-lit',term.dataset.diagram === id && term.dataset.node === node)); });
      preview.addEventListener('mouseleave',()=>all('.term-lit').forEach(term=>term.classList.remove('term-lit')));
    });
  }
  // Walk-through: step lists that point into a diagram, and sequence diagrams message by message.
  // Each step lights its part of the diagram; arrow keys move, Escape ends.
  let walking = null;
  function walk(control, items, show) {
    const stop = () => { walking?.end(); };
    if (walking?.control === control) { stop(); return; }
    stop();
    let index = 0;
    const bar = document.createElement('div'); bar.className = 'walk-bar';
    bar.innerHTML = `<button type="button" data-walk="prev">← ${words.prev}</button><span class="walk-count"></span><button type="button" data-walk="next">${words.next} →</button><span class="walk-text" aria-live="polite"></span><button type="button" data-walk="end">${words.end}</button>`;
    // A diagram's bar sits above the diagram, so it stays in view while a tall diagram scrolls past.
    const figure = control.closest('figcaption')?.closest('figure'); if (figure) figure.before(bar); else control.after(bar);
    control.setAttribute('aria-pressed','true');
    // The bar changes the panel height the board was planned with.
    const replan = () => requestAnimationFrame(()=>{ layoutBoard(); ensureDiagramReadability(); });
    replan();
    const render = () => { bar.querySelector('.walk-count').textContent = `${index + 1} / ${items.length}`; bar.querySelector('.walk-text').textContent = show(index) || ''; };
    const move = delta => { index = Math.max(0,Math.min(items.length - 1,index + delta)); render(); };
    bar.addEventListener('click',event=>{ const action = event.target.closest('[data-walk]')?.dataset.walk; if (action === 'end') stop(); else if (action) move(action === 'next' ? 1 : -1); });
    const keys = event => { if (event.target.closest('input,textarea') || viewerDialog.open) return; if (event.key === 'ArrowRight') { event.preventDefault(); move(1); } else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); } else if (event.key === 'Escape') stop(); };
    document.addEventListener('keydown',keys);
    walking = {control,end:()=>{ document.removeEventListener('keydown',keys); bar.remove(); control.setAttribute('aria-pressed','false'); show(-1); walking = null; replan(); }};
    render();
  }
  function setupWalks() {
    all('ol.steps').forEach(list=>{
      const steps = all(':scope>li',list).filter(item=>item.querySelector('[data-diagram-link]'));
      if (steps.length < 2) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'walk-start interactive'; button.textContent = `▶ ${words.walk}`; button.setAttribute('aria-pressed','false');
      list.before(button);
      button.addEventListener('click',()=>walk(button,steps,index=>{
        steps.forEach((step,i)=>step.classList.toggle('walk-current',i === index));
        all('.diagram-preview').forEach(preview=>spotlight(preview));
        if (index < 0) return;
        const {preview,nodes,edges} = targetOf(steps[index].querySelector('[data-diagram-link]'));
        spotlight(preview,nodes,edges);
        const box = preview?.getBoundingClientRect();
        if (box && (box.bottom < 0 || box.top > innerHeight)) preview.scrollIntoView({block:'nearest',behavior:'smooth'});
      }));
    });
    all('.block-diagram').forEach(block=>{
      if (diagrams[block.id]?.diagramType !== 'sequence') return;
      const preview = block.querySelector('.diagram-preview'), messages = all('[data-edge-id]',preview);
      if (messages.length < 2) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button walk-start'; button.textContent = `▶ ${words.walkMessages}`; button.setAttribute('aria-pressed','false');
      block.querySelector('figcaption button')?.before(button);
      const label = id => preview.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.dataset.nodeLabel || id;
      button.addEventListener('click',()=>walk(button,messages,index=>{
        if (index < 0) { spotlight(preview); return; }
        const message = messages[index];
        spotlight(preview,[message.dataset.edgeFrom,message.dataset.edgeTo],[message.dataset.edgeId]);
        const box = message.getBoundingClientRect();
        if (box.top < 0 || box.bottom > innerHeight - 80) message.scrollIntoView({block:'center',behavior:'smooth'});
        return `${label(message.dataset.edgeFrom)} → ${label(message.dataset.edgeTo)}${say(': ','：')}${message.dataset.edgeLabel || ''}`;
      }));
    });
  }
  all('[data-copy]').forEach(button=>button.addEventListener('click',()=>{
    const text = button.closest('figure').querySelector('pre code').textContent;
    Promise.resolve(navigator.clipboard?.writeText(text)).then(()=>{button.textContent = words.copied;setTimeout(()=>{button.textContent = words.copy;},1600);},()=>notify(say('Copy failed.','复制失败。')));
  }));
  // Follow-up questions: a reader asks about a panel, or about selected text in it, and copies a
  // message that names the page, the panel ID and the quote, so the agent can revise just that panel.
  function setupAsk() {
    const dialog = document.createElement('dialog'); dialog.className = 'ask-dialog';
    dialog.innerHTML = `<form method="dialog"><header><h2></h2><button type="button" data-ask-cancel aria-label="${words.askCancel}">×</button></header><blockquote hidden></blockquote><div class="ask-chips">${words.askChips.map(chip=>`<button type="button" data-chip>${chip}</button>`).join('')}</div><textarea rows="3" placeholder="${words.askPlaceholder}"></textarea><footer><button type="button" data-ask-cancel>${words.askCancel}</button><button type="submit" class="primary">${words.askCopy}</button></footer></form>`;
    document.body.append(dialog);
    const area = dialog.querySelector('textarea'), quoteBox = dialog.querySelector('blockquote');
    let context = null;
    const open = (panel, quote = '') => {
      const number = panel.id === 'answer' ? words.answer : panel.querySelector('.panel-id')?.textContent.trim();
      const title = panel.id === 'answer' ? words.answer : panel.dataset.title || panel.querySelector('h2')?.textContent.trim();
      context = {panel,quote,number,title};
      dialog.querySelector('h2').textContent = `${words.ask} · ${panel.id === 'answer' ? title : `${number} ${title}`}`;
      quoteBox.hidden = !quote; quoteBox.textContent = quote;
      area.value = ''; dialog.showModal(); area.focus();
    };
    dialog.querySelectorAll('[data-chip]').forEach(chip=>chip.addEventListener('click',()=>{ area.value = area.value ? `${area.value}\n${chip.textContent}` : chip.textContent; area.focus(); }));
    dialog.querySelectorAll('[data-ask-cancel]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
    dialog.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();
      const {panel,quote,number,title} = context, page = document.querySelector('h1')?.textContent.trim();
      const file = location.protocol === 'file:' ? decodeURIComponent(location.pathname) : location.href.split('#')[0];
      const quoteMark = text => english ? `"${text}"` : `「${text}」`;
      const lines = [
        `${words.askPage}${say(': ','：')}${quoteMark(page)}`,
        `${words.askFile}${say(': ','：')}${file}`,
        `${words.askWhere}${say(': ','：')}${panel.id === 'answer' ? title : say(`Panel ${number} ${quoteMark(title)}`,`面板 ${number}${quoteMark(title)}`)}${say(` (ID: ${panel.id})`,`（ID: ${panel.id}）`)}`,
        ...(quote ? [`${words.askQuoteLabel}${say(': ','：')}${quoteMark(quote)}`] : []),
        `${words.askQuestion}${say(': ','：')}${area.value.trim() || words.askChips[0]}`,
        ...(panel.id === 'answer' ? [] : [words.askPatch]),
      ];
      const text = lines.join('\n');
      Promise.resolve(navigator.clipboard?.writeText(text)).then(()=>{ dialog.close(); notify(words.askCopied); },()=>{ area.value = text; area.select(); });
    });
    all('.panel').forEach(panel=>{
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ask-button interactive'; button.textContent = words.ask;
      button.addEventListener('click',()=>open(panel));
      panel.querySelector('.panel-head')?.append(button);
    });
    const floating = document.createElement('button'); floating.type = 'button'; floating.className = 'ask-floating'; floating.textContent = words.askQuote; floating.hidden = true;
    document.body.append(floating);
    let selected = null;
    document.addEventListener('selectionchange',()=>{
      const selection = getSelection(), text = selection.toString().replace(/\s+/g,' ').trim();
      const panel = selection.rangeCount ? selection.getRangeAt(0).commonAncestorContainer.parentElement?.closest?.('.panel') || (selection.getRangeAt(0).commonAncestorContainer.closest?.('.panel')) : null;
      if (!panel || text.length < 2 || dialog.open) { floating.hidden = true; selected = null; return; }
      const box = selection.getRangeAt(0).getBoundingClientRect();
      selected = {panel,text:text.slice(0,400)};
      floating.style.left = `${Math.max(8,Math.min(innerWidth - 120,box.left + box.width / 2 - 45 + scrollX))}px`;
      floating.style.top = `${box.top + scrollY - 38}px`;
      floating.hidden = false;
    });
    floating.addEventListener('mousedown',event=>event.preventDefault());
    floating.addEventListener('click',()=>{ if (selected) open(selected.panel,selected.text); floating.hidden = true; });
  }
  // Source cards: hovering or focusing a citation shows where the claim comes from, with the pinned
  // code excerpt for a repository source, so a reader can check it without leaving the page.
  function setupSourceCards() {
    const sources = prepared.preparedSources?.sources || {};
    const card = document.createElement('div'); card.className = 'source-card'; card.hidden = true; card.setAttribute('role','tooltip');
    document.body.append(card);
    let hideTimer;
    const hide = () => { hideTimer = setTimeout(()=>{ card.hidden = true; },160); };
    card.addEventListener('mouseenter',()=>clearTimeout(hideTimer)); card.addEventListener('mouseleave',hide);
    const show = (link, id = decodeURIComponent(link.getAttribute('href').slice('#source-'.length))) => {
      const source = sources[id] || prepared.document?.sources?.find(entry=>entry.id === id);
      if (!source) return;
      clearTimeout(hideTimer);
      const escapeText = value => String(value ?? '').replace(/[&<>"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[character]));
      const location = source.path ? `${source.path}${source.lines ? `:${source.lines.join('–')}` : ''}${source.revision ? ` @ ${String(source.revision).slice(0,10)}` : ''}` : (()=>{ try { return new URL(source.url).host; } catch { return ''; } })();
      const lines = typeof source.text === 'string' ? source.text.split('\n') : [];
      const first = source.lines?.[0] || 1;
      const excerpt = lines.length ? `<pre><code>${lines.slice(0,14).map((line,index)=>`<span class="line"><i>${first + index}</i>${escapeText(line) || ' '}</span>`).join('')}${lines.length > 14 ? `<span class="line more"><i></i>…</span>` : ''}</code></pre>` : '';
      card.innerHTML = `<b>${escapeText(source.title || source.path || id)}</b>${location ? `<code class="source-where">${escapeText(location)}</code>` : ''}${excerpt}${source.url ? `<a href="${escapeText(source.url)}" target="_blank" rel="noopener noreferrer">${say('Open source','打开原文')} ↗</a>` : ''}`;
      card.hidden = false;
      const box = link.getBoundingClientRect(), width = Math.min(520,innerWidth - 24);
      card.style.width = `${width}px`;
      card.style.left = `${Math.max(12,Math.min(innerWidth - width - 12,box.left - 24)) + scrollX}px`;
      const below = box.bottom + 8 + card.offsetHeight < innerHeight;
      card.style.top = `${(below ? box.bottom + 8 : box.top - 8 - card.offsetHeight) + scrollY}px`;
    };
    all('.cite a[href^="#source-"]').forEach(link=>{
      link.addEventListener('mouseenter',()=>show(link)); link.addEventListener('focus',()=>show(link));
      link.addEventListener('mouseleave',hide); link.addEventListener('blur',hide);
    });
    // A diagram node tied to a source opens the same card, so a code diagram doubles as a code tour.
    all('.diagram-preview[data-node-sources]').forEach(preview=>{
      let map = {}; try { map = JSON.parse(preview.dataset.nodeSources); } catch {}
      all('[data-node-id]',preview).forEach(node=>{
        const id = map[node.dataset.nodeId]; if (!id) return;
        node.classList.add('has-source');
        node.addEventListener('mouseenter',()=>show(node,id)); node.addEventListener('mouseleave',hide);
      });
    });
    document.addEventListener('keydown',event=>{ if (event.key === 'Escape') card.hidden = true; });
  }
  // Checklist ticks are the reader's own progress; keep them per page and block across reloads.
  all('.checklist').forEach(list=>{
    const key = `archify-checklist:${root.dataset.artifact}:${list.closest('.block').id}`, boxes = all('input',list);
    let saved = []; try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    boxes.forEach((box,index)=>{ box.checked = saved[index] === 1; box.addEventListener('change',()=>{ try { localStorage.setItem(key,JSON.stringify(boxes.map(b=>b.checked ? 1 : 0))); } catch {} }); });
  });
  // Native dialogs supply Escape, focus trapping and the accessible modal semantics.
  const printDetails = new Map();
  all('.diagram-semantics').forEach(details=>details.open = false);
  window.addEventListener('beforeprint',()=>all('.diagram-semantics').forEach(details=>{printDetails.set(details,details.open);details.open = true;}));
  window.addEventListener('afterprint',()=>{printDetails.forEach((open,details)=>details.open = open);printDetails.clear();});
  root.classList.add('js');
  applyTheme();
  cropDiagramPreviews();
  linkTerms();
  setupWalks();
  setupAsk();
  setupSourceCards();
  layoutBoard();
  const relayout = () => { layoutBoard(); ensureDiagramReadability(); };
  Promise.resolve(document.fonts?.ready).then(()=>requestAnimationFrame(()=>requestAnimationFrame(relayout)));
  let resizeFrame;
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame = requestAnimationFrame(relayout);});
})();
