/* Precomputed famous-game evidence. No engine/model downloads or browser storage. */
// SPDX-License-Identifier: AGPL-3.0-only
(() => {
  'use strict';
  const root = document.getElementById('brilly-explorer');
  if (!root) return;
  const byId = id => document.getElementById('brilly-' + id);
  const grade = label => ({brilliant:'Brilliant !!',good:'Good !',interesting:'Interesting !?',dubious:'Dubious ?!',mistake:'Mistake ?',blunder:'Blunder ??'}[label] || 'Unmarked');
  const glyph = label => ({brilliant:'!!',good:'!',interesting:'!?',dubious:'?!',mistake:'?',blunder:'??'}[label] || 'Unmarked');
  let data, gameId, ply, quality = 'fast', after = false;
  const game = () => data.games.find(g => g.id === gameId);
  const current = () => game().cases.find(c => c.ply === ply);
  const metric = (id, value) => { const node = byId(id); if (node) node.textContent = value; };
  function tally() {
    const t = data.totals[quality];
    metric('tally', `${t.oldHits} → ${t.newHits} of ${t.targets} published landmarks found`);
    metric('total-awards', `Total Brilliant awards across the nine games: previous ${t.oldAwards}; Open Brilly Finder ${t.newAwards}.`);
    for (const g of data.games) {
      const s = g.stats[quality];
      document.querySelector(`[data-game-old="${g.id}"]`).textContent = `${s.oldHits}/${s.targets}`;
      document.querySelector(`[data-game-new="${g.id}"]`).textContent = `${s.newHits}/${s.targets}`;
    }
    document.querySelectorAll('[data-quality]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.quality === quality)));
  }
  function options() {
    const select = byId('position'); select.replaceChildren();
    for (const landmark of [true,false]) {
      const group = document.createElement('optgroup'); group.label = landmark ? 'Published !! landmarks' : 'Other source-listed or awarded moves';
      for (const c of game().cases.filter(c => c.landmark === landmark)) {
        const option = document.createElement('option'); option.value = c.ply;
        option.textContent = c.move + (c.diagnostic ? ' · search diagnostic' : '') + (c.sourceMark ? ` · published ${c.sourceMark}` : '');
        group.append(option);
      }
      if (group.children.length) select.append(group);
    }
    select.value = String(ply);
  }
  function board() {
    const c = current(), node = byId('board'), fen = after ? c.after : c.before;
    node.replaceChildren();
    node.setAttribute('aria-label', `${after?'After':'Before'} ${c.move}. White at bottom. FEN ${fen}`);
    fen.split(' ')[0].split('/').forEach((rank,r) => {
      let f = 0;
      for (const ch of rank) {
        const empty = /[1-8]/.test(ch), count = empty ? Number(ch) : 1;
        for (let n=0;n<count;n++,f++) {
          const square = document.createElement('div'), name = 'abcdefgh'[f] + (8-r);
          square.className = 'brilly-square' + ((r+f)%2?' dark':'') + ([c.uci.slice(0,2),c.uci.slice(2,4)].includes(name)?' last':'');
          square.setAttribute('aria-hidden','true');
          if (!empty) {
            const img = document.createElement('img'); img.className='brilly-piece'; img.alt=''; img.draggable=false;
            img.src=`artwork/${ch===ch.toUpperCase()?'w':'b'}${ch.toUpperCase()}.webp`;
            square.append(img);
          }
          node.append(square);
        }
      }
    });
    const point = sq => [sq.charCodeAt(0)-97+.5, 8-Number(sq[1])+.5];
    const [x1,y1] = point(c.uci.slice(0,2)), [x2,y2] = point(c.uci.slice(2,4));
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 8 8'); svg.setAttribute('aria-hidden','true'); svg.classList.add('brilly-arrow');
    svg.innerHTML=`<defs><marker id="brilly-head" markerWidth="3" markerHeight="3" refX="2.3" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 Z" fill="currentColor"/></marker></defs><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width=".13" marker-end="url(#brilly-head)"/>`;
    node.append(svg);
    byId('before').setAttribute('aria-pressed',String(!after)); byId('after').setAttribute('aria-pressed',String(after));
  }
  function evidence() {
    const g=game(), c=current(), m=c.modes[quality];
    metric('case-title',c.move); metric('game-title',`${g.title} · ${g.year}`);
    metric('annotation',c.diagnostic ? 'Post-run search diagnostic' : c.sourceMark ? `Published ${c.sourceMark}` : 'Not listed in the chosen annotation');
    const link=byId('annotation-source'); link.href=g.source.url; link.textContent='Read the chosen annotation';
    metric('idea',c.idea || 'This move is included because at least one classifier awarded it Brilliant, or it was separately marked in the chosen source.');
    metric('old',grade(m.old)); metric('new',grade(m.new));
    const changed = m.old===m.new ? 'Same grade in this mode.' : `${grade(m.old)} → ${grade(m.new)}`;
    metric('change',changed);
    metric('reason',m.reason);
    metric('model',m.candidate == null ? 'A standalone model diagnostic was not recorded for this mode.' : m.candidate ? `Model score ${Number(m.score).toFixed(4)}; fixed cutoff ${data.cutoff.toFixed(4)}. This is not a probability.` : 'The exchange gate fails, so tree inference is skipped.');
    metric('engine',`Achieved depths: before ${m.depths[0]}, after ${m.depths[1]}. Before: ${m.beforePV || 'terminal position'}. After: ${m.afterPV || 'terminal position'}.`);
    metric('game-awards',`Total Brilliant awards in this game: previous ${g.stats[quality].oldAwards}; new ${g.stats[quality].newAwards}.`);
    const cases=g.cases, index=cases.indexOf(c);
    byId('previous').disabled=index===0; byId('next').disabled=index===cases.length-1;
    metric('case-count',`${index+1} / ${cases.length}`);
    const body=byId('all-awards'); body.replaceChildren();
    for (const item of cases) {
      const v=item.modes[quality];
      if (v.old!=='brilliant' && v.new!=='brilliant' && !item.landmark && !item.sourceListed && !item.diagnostic) continue;
      const tr=document.createElement('tr');
      for (const value of [item.move,item.sourceMark || 'Not listed',glyph(v.old),glyph(v.new)]) {
        const td=document.createElement('td'); td.textContent=value; tr.append(td);
      }
      body.append(tr);
    }
  }
  function render() { options(); board(); evidence(); tally(); }
  fetch('results.json', {cache:'no-cache'}).then(r => {if(!r.ok) throw new Error('Results unavailable'); return r.json();}).then(value => {
    data=value; gameId=data.games[0].id; ply=data.games[0].defaultPly;
    const select=byId('game'); select.replaceChildren();
    for (const g of data.games) {const o=document.createElement('option');o.value=g.id;o.textContent=`${g.title} · ${g.year}`;select.append(o);}
    select.addEventListener('change', e => {gameId=e.target.value;ply=game().defaultPly;after=false;render();});
    byId('position').addEventListener('change',e=>{ply=Number(e.target.value);after=false;render();});
    for (const phase of ['before','after']) byId(phase).addEventListener('click',()=>{after=phase==='after';board();});
    for (const [name,delta] of [['previous',-1],['next',1]]) byId(name).addEventListener('click',()=>{
      const cases=game().cases,index=cases.findIndex(c=>c.ply===ply);if(!cases[index+delta])return;ply=cases[index+delta].ply;after=false;render();
    });
    document.querySelectorAll('[data-quality]').forEach(b=>b.addEventListener('click',()=>{quality=b.dataset.quality;render();}));
    root.hidden=false;byId('load-status').hidden=true;render();
  }).catch(()=>{byId('load-status').textContent='Interactive results could not load. The complete tables and diagrams below are still available.';});
})();
