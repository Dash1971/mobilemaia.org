/* Recorded classical/online comparisons. No inference or browser storage. */
// SPDX-License-Identifier: AGPL-3.0-only
(() => {
  'use strict';
  const root = document.getElementById('brilly-explorer');
  if (!root) return;
  const byId = id => document.getElementById('brilly-' + id);
  const grade = label => ({brilliant:'Brilliant !!',good:'Good !',interesting:'Interesting !?',dubious:'Dubious ?!',mistake:'Mistake ?',blunder:'Blunder ??'}[label] || 'Unmarked');
  const glyph = label => ({brilliant:'!!',good:'!',interesting:'!?',dubious:'?!',mistake:'?',blunder:'??'}[label] || 'Unmarked');
  let data, online, sources, gameId, ply, quality = 'fast', after = false;
  const game = () => [...data.games,...online.games].find(g => g.id === gameId);
  const current = () => game().cases.find(c => c.ply === ply);
  const metric = (id, value) => { const node = byId(id); if (node) node.textContent = value; };
  function tally() {
    const t = data.totals[quality];
    metric('tally', `${t.oldHits} → ${t.newHits} of ${t.targets} published Brilliant moves found`);
    metric('total-awards', `Total Brilliant awards across the nine classics: En Croissant (adapted) ${t.oldAwards}; Open Brilly Finder ${t.newAwards}.`);
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
      const group = document.createElement('optgroup'); group.label = landmark ? (game().collection==='online'?'Recorded Chess.com Brilliants':'Published !! moves') : 'Other moves in the comparison';
      for (const c of game().cases.filter(c => c.landmark === landmark)) {
        const option = document.createElement('option'); option.value = c.ply;
        option.textContent = c.move + (c.diagnostic ? ' · search diagnostic' : '') + (c.sourceMark ? (game().collection==='online'?' · recorded !!':` · published ${c.sourceMark}`) : '');
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
    const g=game(), c=current(), q=g.collection==='online'?'fast':quality, m=c.modes[q];
    metric('case-title',c.move); metric('game-title',`${g.title} · ${g.year}`);
    const isOnline=g.collection==='online', source=sources[g.id];
    metric('reference-label',isOnline?'Recorded Chess.com review · November 22, 2026':'Published annotation');
    metric('annotation',isOnline?c.referenceLabel.replace('Chess.com review: ',''):c.sourceMark==='!!'?'Brilliant !!':c.sourceMark||'Not marked in this source');
    metric('source-credit',isOnline?'Chess.com Game Review':`${source.byline} · ${source.location}`);
    const link=byId('annotation-source'); link.href=g.source.url; link.textContent=isOnline?'View the original game':source.publication;
    metric('result-heading',`Mobile Maia results · ${q[0].toUpperCase()+q.slice(1)} analysis`);
    byId('quality').value=q;byId('quality').disabled=isOnline;
    metric('idea',c.idea || (g.collection==='online'?`Fast analysis; ${g.accountName}’s moves are scored against the recorded November 22, 2026 review.`:'Included because a detector awarded it Brilliant or the published source marked it.'));
    metric('old',grade(m.old)); metric('new',grade(m.new));
    const changed = m.old==='brilliant' && m.new==='brilliant'?'Both detectors label this move Brilliant.':m.new==='brilliant'?'Open Brilly Finder labels this move Brilliant; En Croissant (adapted) does not.':m.old==='brilliant'?'En Croissant (adapted) labels this move Brilliant; Open Brilly Finder does not.':'Neither detector labels this move Brilliant.';
    metric('change',changed);
    metric('reason',m.reason);
    metric('model',m.candidate == null ? 'A standalone model diagnostic was not recorded for this mode.' : m.candidate ? `Model score ${Number(m.score).toFixed(4)}; fixed cutoff ${data.cutoff.toFixed(4)}. This is not a probability.` : 'The exchange gate fails, so tree inference is skipped.');
    metric('engine',`Achieved depths: before ${m.depths[0]}, after ${m.depths[1]}. Before: ${m.beforePV || 'terminal position'}. After: ${m.afterPV || 'terminal position'}.`);
    metric('game-awards',`Brilliant awards ${g.collection==='online'?'on '+g.account+'’s moves':'in this game'} (${q}): En Croissant (adapted) ${g.stats[q].oldAwards}; Open Brilly Finder ${g.stats[q].newAwards}.`);
    const cases=g.cases, index=cases.indexOf(c);
    byId('previous').disabled=index===0; byId('next').disabled=index===cases.length-1;
    metric('case-count',`${index+1} / ${cases.length}`);
    const body=byId('all-awards'); body.replaceChildren();
    for (const item of cases) {
      const v=item.modes[q];
      if (v.old!=='brilliant' && v.new!=='brilliant' && !item.landmark && !item.sourceListed && !item.diagnostic) continue;
      const tr=document.createElement('tr');
      for (const value of [item.move,item.referenceLabel || item.sourceMark || 'Not marked',glyph(v.old),glyph(v.new)]) {
        const td=document.createElement('td'); td.textContent=value; tr.append(td);
      }
      body.append(tr);
    }
  }
  function render() { options(); board(); evidence(); tally(); }
  Promise.all(['results.json','online-results.json','annotation-sources.json'].map(path=>fetch(path,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Results unavailable');return r.json();}))).then(values => {
    [data,online,sources]=values; gameId=data.games[0].id; ply=data.games[0].defaultPly;
    const select=byId('game'); select.replaceChildren();
    for(const [title,games] of [['Classical games',data.games],['Online games · Fast analysis',online.games]]){
      const group=document.createElement('optgroup');group.label=title;
      for (const g of games) {const o=document.createElement('option');o.value=g.id;o.textContent=`${g.title} · ${g.year}`;group.append(o);}
      select.append(group);
    }
    select.addEventListener('change', e => {gameId=e.target.value;ply=game().defaultPly;after=false;render();});
    byId('position').addEventListener('change',e=>{ply=Number(e.target.value);after=false;render();});
    for (const phase of ['before','after']) byId(phase).addEventListener('click',()=>{after=phase==='after';board();});
    for (const [name,delta] of [['previous',-1],['next',1]]) byId(name).addEventListener('click',()=>{
      const cases=game().cases,index=cases.findIndex(c=>c.ply===ply);if(!cases[index+delta])return;ply=cases[index+delta].ply;after=false;render();
    });
    document.querySelectorAll('[data-quality]').forEach(b=>b.addEventListener('click',()=>{quality=b.dataset.quality;render();}));
    byId('quality').addEventListener('change',event=>{quality=event.target.value;render();});
    document.querySelectorAll('[data-open-game]').forEach(button=>button.addEventListener('click',()=>{
      gameId=button.dataset.openGame;ply=Number(button.dataset.openPly)||game().defaultPly;after=false;select.value=gameId;render();
    }));
    root.hidden=false;byId('load-status').hidden=true;render();
  }).catch(()=>{byId('load-status').textContent='Interactive results could not load. The complete tables and diagrams below are still available.';});
})();
