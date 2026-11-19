/* indiaemerges chart and control toolkit, shared by every dashboard.
   Needs d3 v7 loaded first. Exposes window.IE. */
(function(){
"use strict";
const IE={};
IE.PAL=['#6FD3EA','#F3E67C','#F590C6','#A99AF5','#8FE39A','#FFFFFF','#F7A873','#8E949A'];
const AX='rgba(255,255,255,.78)';

/* ---------- small helpers ---------- */
IE.esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
IE.IN=(n,d)=>Number(n).toLocaleString('en-IN',{maximumFractionDigits:d||0,minimumFractionDigits:d||0});
IE.h=function(tag,attrs,kids){const e=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(v===false||v==null)continue;if(k==='text')e.textContent=v;else if(k==='html')e.innerHTML=v;else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),v);else e.setAttribute(k,v);}
  (kids||[]).forEach(c=>{if(c)e.appendChild(typeof c==='string'?document.createTextNode(c):c);});return e;};
const h=IE.h, esc=IE.esc;

/* kinds: pct (%), pp (percentage points), idx (index), num (count), cr (₹ crore), rs (₹), x (ratio), raw */
IE.fmt=function(v,kind){
  if(v==null||!isFinite(v))return 'n/a';
  const a=Math.abs(v);
  switch(kind){
    case 'pct':return (a>=100?v.toFixed(0):a>=1||a===0?v.toFixed(1):v.toFixed(2)).replace(/^-/,'−')+'%';
    case 'pp':return (v>0?'+':'')+v.toFixed(1).replace(/^-/,'−')+' pp';
    case 'idx':return v.toFixed(1);
    case 'rs':return (v<0?'−':'')+'₹'+IE.IN(Math.round(a));
    case 'num':return a>=1e7?(v/1e7).toFixed(2)+' crore':a>=1e5?(v/1e5).toFixed(2)+' lakh':IE.IN(Math.round(v));
    case 'cr':return (v<0?'−':'')+(a>=1e5?'₹'+(a/1e5).toFixed(2)+' lakh cr':a>=100?'₹'+IE.IN(Math.round(a))+' cr':'₹'+a.toFixed(2)+' cr');
    case 'x':return v.toFixed(2);
    default:return IE.IN(v,a<10?2:0);
  }
};
IE.tickFmt=function(kind,max){
  if(kind==='pct')return v=>d3.format(max<5?'.1f':'.0f')(v).replace('-','−')+'%';
  if(kind==='idx'||kind==='x')return d3.format(max<5?'.1f':'.0f');
  if(kind==='pp')return v=>d3.format(max<5?'.1f':'.0f')(v).replace('-','−');
  if(kind==='rs')return v=>max>=2e5?'₹'+d3.format('.1f')(v/1e5)+'L':'₹'+IE.IN(v);
  if(kind==='num')return v=>max>=1e7?d3.format('.1f')(v/1e7)+' cr':max>=1e5?d3.format(max<1e6?'.1f':'.0f')(v/1e5)+' lakh':IE.IN(v);
  if(kind==='cr')return v=>max>=2e5?'₹'+d3.format(max<1e6?'.1f':'.0f')(v/1e5)+'L cr':'₹'+IE.IN(v)+' cr';
  return d3.format('~s');
};
IE.sw=(c,ln)=>'<i class="sw'+(ln?' ln':'')+'" style="background:'+c+'"></i>';
IE.legend=function(items,ln){return h('div',{class:'legend',html:items.map(i=>'<span>'+IE.sw(i.color,ln)+esc(i.name)+'</span>').join('')});};

/* ---------- tooltip ---------- */
let tipEl=null;
IE.tip={show(html,ev){if(ev&&ev.touches){if(Date.now()-tipScroll<400)return;clearTimeout(tipTimer);}if(!tipEl){tipEl=document.getElementById('tip')||document.body.appendChild(h('div',{id:'tip',role:'status'}));}
  tipEl.innerHTML=html;tipEl.style.display='block';const p=ev.touches?ev.touches[0]:ev;const w=tipEl.offsetWidth,hh=tipEl.offsetHeight;
  let x=p.clientX+16,y=p.clientY+16;if(x+w>innerWidth-8)x=p.clientX-w-16;if(x<8)x=8;if(y+hh>innerHeight-8)y=p.clientY-hh-16;if(y<8)y=8;tipEl.style.left=x+'px';tipEl.style.top=y+'px';},
  hide(){if(tipEl)tipEl.style.display='none';}};
/* touch screens have no mouseleave: hide the card when the page scrolls, when the reader taps elsewhere,
   and a few seconds after they lift their finger */
let tipScroll=0,tipTimer=null;
function tipClear(){if(!tipEl||tipEl.style.display==='none')return;IE.tip.hide();document.querySelectorAll('svg rect[fill="transparent"]').forEach(r=>r.dispatchEvent(new Event('mouseleave')));}
addEventListener('scroll',()=>{tipScroll=Date.now();tipClear();},{passive:true});
document.addEventListener('touchstart',e=>{clearTimeout(tipTimer);if(!(e.target.closest&&e.target.closest('svg')))tipClear();},{passive:true});
document.addEventListener('touchend',()=>{clearTimeout(tipTimer);tipTimer=setTimeout(tipClear,3000);},{passive:true});

/* ---------- controls ---------- */
let uid=0;
IE.ctl=function(label,el){if(!el.id)el.id='c'+(++uid);return h('div',{class:'ctl'},[h('label',{for:el.id,text:label}),el]);};
IE.sel=function(opts,cur,on){const s=h('select',{onchange:e=>on(e.target.value)});opts.forEach(o=>{if(o.group){const g=h('optgroup',{label:o.group});o.items.forEach(x=>{const op=h('option',{value:x[0],text:x[1]});if(String(x[0])===String(cur))op.selected=true;g.appendChild(op);});s.appendChild(g);return;}
  const op=h('option',{value:o[0],text:o[1]});if(String(o[0])===String(cur))op.selected=true;s.appendChild(op);});return s;};
IE.seg=function(opts,cur,on){const d=h('div',{class:'chips',role:'group'});opts.forEach(o=>d.appendChild(h('button',{class:'sm'+(o[0]===cur?' on':''),'aria-pressed':o[0]===cur?'true':'false',text:o[1],onclick:()=>on(o[0])})));return d;};
IE.yearCtl=function(labels,idx,on,tagFn){
  const lab=h('span',{class:'yearval',text:labels[idx]}),tg=h('span',{class:'tag',text:tagFn?tagFn(idx):''});if(!tagFn)tg.style.display='none';
  const r=h('input',{type:'range',min:0,max:labels.length-1,step:1,value:idx,'aria-label':'Year'});r.id='yr'+(++uid);
  r.addEventListener('input',()=>{const i=+r.value;lab.textContent=labels[i];if(tagFn)tg.textContent=tagFn(i);on(i);});
  return h('div',{class:'ctl'},[h('label',{for:r.id,text:'Year'}),h('div',{style:'display:flex;align-items:center;gap:12px;flex-wrap:wrap'},[r,h('span',null,[lab,tg])])]);
};
IE.rangeCtl=function(labels,a,b,on,title){
  const n=labels.length,lab=h('span',{class:'yearval'}),fil=h('div',{class:'fil'});
  const A=h('input',{type:'range',min:0,max:n-1,step:1,value:a,'aria-label':'From'}),B=h('input',{type:'range',min:0,max:n-1,step:1,value:b,'aria-label':'To'});A.id='rg'+(++uid);
  const all=h('button',{class:'sm',text:'All',onclick:()=>{a=0;b=n-1;A.value=a;B.value=b;paint();on(a,b);}});
  function paint(){lab.textContent=labels[a]+' to '+labels[b];fil.style.left=(a/(n-1)*100)+'%';fil.style.right=((1-b/(n-1))*100)+'%';A.style.zIndex=a>n/2?3:2;B.style.zIndex=a>n/2?2:3;all.disabled=a===0&&b===n-1;}
  A.addEventListener('input',()=>{a=Math.min(+A.value,b-1);A.value=a;paint();on(a,b);});
  B.addEventListener('input',()=>{b=Math.max(+B.value,a+1);B.value=b;paint();on(a,b);});
  paint();
  return h('div',{class:'ctl'},[h('label',{for:A.id,text:title||'Period shown'}),h('div',{style:'display:flex;align-items:center;gap:12px;flex-wrap:wrap'},[h('div',{class:'dual'},[h('div',{class:'trk'},[fil]),A,B]),lab,all])]);
};
IE.chips=function(items,onRemove,addOpts,onAdd,max,colorOf){
  const d=h('div',{class:'chips'});
  items.forEach(it=>d.appendChild(h('span',{class:'chip',html:IE.sw(colorOf(it),1)+esc(it.name)},[items.length>1?h('button',{'aria-label':'Remove '+it.name,text:'×',onclick:()=>onRemove(it.key)}):null])));
  if(items.length<max){const s=IE.sel([['','Add…']].concat(addOpts),'',v=>{if(v)onAdd(v);});s.setAttribute('aria-label','Add a series');d.appendChild(s);}
  else d.appendChild(h('span',{class:'est-note',text:'Up to '+max+'. Remove one to add another.'}));
  return d;
};
IE.toCSV=(head,rows)=>{const q=x=>x==null?'':/[",\n]/.test(String(x))?'"'+String(x).replace(/"/g,'""')+'"':String(x);return [head].concat(rows).map(r=>r.map(q).join(',')).join('\n');};
IE.copyBtn=function(get){const b=h('button',{class:'sm',text:'Copy as CSV',onclick:()=>{const done=ok=>{b.textContent=ok?'Copied':'Copy failed: select the table and copy it';setTimeout(()=>b.textContent='Copy as CSV',2200);};try{navigator.clipboard.writeText(get()).then(()=>done(true),()=>done(false));}catch(e){done(false);}}});return b;};
IE.table=function(head,rows){const t=h('table'),tr=h('tr');head.forEach(x=>tr.appendChild(h('th',{text:x})));t.appendChild(h('thead',null,[tr]));const tb=h('tbody');rows.forEach(r=>{const e=h('tr');r.forEach(x=>e.appendChild(h('td',{text:x==null?'':x})));tb.appendChild(e);});t.appendChild(tb);return h('div',{class:'tblwrap'},[t]);};

/* ---------- x-axis ticks that never collide ---------- */
IE.xTicks=function(labels,a,b,pw,align,minStep){
  align=align||(i=>i);const lw=d3.max(labels.slice(a,b+1),l=>String(l).length)*8.4+14;const fit=Math.max(1,Math.floor(pw/lw));
  const steps=[1,2,3,4,6,12,24,36,48,60,120,240].filter(s=>s>=(minStep||1)),idx=d3.range(a,b+1);
  for(const s of steps){let best=null;
    for(let off=0;off<s;off++){const t=idx.filter(i=>((align(i)-off)%s+s)%s===0);if(t.length<=fit&&(!best||t.length>best.length))best=t;}
    if(best&&best.length)return best;}
  return [a];
};
function edgeFix(xa,W){xa.selectAll('text').each(function(){const b=this.getBBox();if(b.x+b.width>W-1){d3.select(this).attr('text-anchor','end').attr('x',W-1);}else if(b.x<1){d3.select(this).attr('text-anchor','start').attr('x',1);}});}
function bands(g,x,y0,y1,list,bw){(list||[]).forEach(bd=>{const x0=x(bd.from)-bw/2,x1=x(bd.to)+bw/2;g.append('rect').attr('x',x0).attr('y',y0).attr('width',Math.max(2,x1-x0)).attr('height',y1-y0).attr('fill','#fff').attr('opacity',bd.op||.08);
  if(bd.label)g.append('text').attr('x',(x0+x1)/2).attr('y',y0-6).attr('text-anchor','middle').attr('font-size',12).attr('fill',AX).text(bd.label);});}
function yAxis(svg,y,ticks,tf,m,W){const gg=svg.append('g').attr('class','gridl');ticks.forEach(t=>gg.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',y(t)).attr('y2',y(t)));
  const ya=svg.append('g').attr('class','axis');ticks.forEach(t=>ya.append('text').attr('x',m.l-8).attr('y',y(t)+5).attr('text-anchor','end').text(tf(t)));
  if(y.domain()[0]<0&&y.domain()[1]>0)svg.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',y(0)).attr('y2',y(0)).attr('stroke','#888');}
function empty(el,msg){el.textContent='';el.appendChild(h('p',{class:'empty',text:msg||'No data for this selection.'}));}

/* ---------- line chart ---------- */
IE.lineChart=function(el,o){
  const L=o.labels,series=o.series.map(s=>Object.assign({},s,{pts:s.pts.filter(p=>p[1]!=null&&isFinite(p[1]))})).filter(s=>s.pts.length);
  el.textContent='';if(!series.length)return empty(el,o.empty);
  const W=el.clientWidth||600,wide=W>640,end=wide&&o.endLabels!==false&&series.length>1,Ht=o.height||(wide?420:330);
  const m={t:o.bands&&o.bands.some(b=>b.label)?32:16,r:end?168:16,b:34,l:10};
  const all=series.flatMap(s=>s.pts);let a=d3.min(all,p=>p[0]),b=d3.max(all,p=>p[0]);if(a===b){a=Math.max(0,a-1);b=Math.min(L.length-1,b+1);}
  let lo=d3.min(all,p=>p[1]),hi=d3.max(all,p=>p[1]);if(o.zero!==false&&o.kind!=='idx'){lo=Math.min(0,lo);hi=Math.max(0,hi);}if(lo===hi){lo-=1;hi+=1;}
  const y=d3.scaleLinear().domain([lo,hi]).nice(6).range([Ht-m.b,m.t]);const ticks=y.ticks(6),tf=IE.tickFmt(o.kind,Math.max(Math.abs(y.domain()[0]),Math.abs(y.domain()[1])));
  m.l=Math.max(44,d3.max(ticks,t=>tf(t).length)*8.6+10);
  const x=d3.scaleLinear().domain([a,b]).range([m.l+8,W-m.r-8]);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Line chart');
  yAxis(svg,y,ticks,tf,m,W);
  const xa=svg.append('g').attr('class','axis');IE.xTicks(L,a,b,W-m.l-m.r-16,o.align,o.minStep).forEach(i=>xa.append('text').attr('x',x(i)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(o.tickLabel?o.tickLabel(i):L[i]));
  edgeFix(xa,W);
  bands(svg.append('g'),x,m.t,Ht-m.b,o.bands,(x(a+1)-x(a))||10);
  const ln=d3.line().x(p=>x(p[0])).y(p=>y(p[1]));
  series.forEach(s=>{const segs=[];let cur=[];s.pts.forEach((p,i)=>{if(i&&p[0]!==s.pts[i-1][0]+1){segs.push(cur);cur=[];}cur.push(p);});segs.push(cur);
    segs.forEach(sg=>{if(sg.length>1)svg.append('path').attr('d',ln(sg)).attr('fill','none').attr('stroke',s.color).attr('stroke-width',s.bold?3:2).attr('stroke-dasharray',s.dash||null).attr('stroke-linejoin','round');
      else svg.append('circle').attr('cx',x(sg[0][0])).attr('cy',y(sg[0][1])).attr('r',3).attr('fill',s.color);});
    const e=s.pts[s.pts.length-1];svg.append('circle').attr('cx',x(e[0])).attr('cy',y(e[1])).attr('r',4.5).attr('fill',s.color).attr('stroke','#000').attr('stroke-width',2);});
  if(end){const labs=series.map(s=>{const e=s.pts[s.pts.length-1];return {s,y:y(e[1])};}).sort((p,q)=>p.y-q.y);
    for(let k=0;k<4;k++){for(let i=1;i<labs.length;i++)if(labs[i].y-labs[i-1].y<19)labs[i].y=labs[i-1].y+19;for(let i=labs.length-1;i>=0;i--){if(labs[i].y>Ht-m.b)labs[i].y=Ht-m.b;if(i<labs.length-1&&labs[i+1].y-labs[i].y<19)labs[i].y=labs[i+1].y-19;}}
    labs.forEach(l=>{let nm=l.s.short||l.s.name;if(nm.length>19)nm=nm.slice(0,18)+'…';svg.append('rect').attr('x',W-m.r+2).attr('y',l.y-1.5).attr('width',8).attr('height',3).attr('fill',l.s.color);svg.append('text').attr('x',W-m.r+14).attr('y',l.y+5).attr('font-size',14).text(nm);});}
  const rule=svg.append('line').attr('y1',m.t).attr('y2',Ht-m.b).attr('stroke','#fff').attr('stroke-opacity',.6).style('display','none'),dots=svg.append('g');
  const ov=svg.append('rect').attr('x',m.l).attr('y',m.t).attr('width',Math.max(0,W-m.l-m.r)).attr('height',Ht-m.t-m.b).attr('fill','transparent');
  function move(ev){const pt=d3.pointer(ev.touches?ev.touches[0]:ev,svg.node());const i=Math.max(a,Math.min(b,Math.round(x.invert(pt[0]))));
    rule.style('display',null).attr('x1',x(i)).attr('x2',x(i));dots.selectAll('*').remove();
    const rows=series.map(s=>{const p=s.pts.find(p=>p[0]===i);return p?{s,v:p[1]}:null;}).filter(Boolean).sort((p,q)=>q.v-p.v);
    rows.forEach(r=>dots.append('circle').attr('cx',x(i)).attr('cy',y(r.v)).attr('r',5).attr('fill',r.s.color).attr('stroke','#000').attr('stroke-width',2));
    IE.tip.show('<div class="t">'+esc(o.tipTitle?o.tipTitle(i):L[i])+'</div>'+rows.map(r=>'<div class="r"><span>'+IE.sw(r.s.color,1)+esc(r.s.name)+'</span><b>'+IE.fmt(r.v,o.kind)+'</b></div>').join('')+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev);}
  ov.on('mousemove',move).on('touchstart',move,{passive:true}).on('touchmove',move,{passive:true}).on('mouseleave',()=>{rule.style('display','none');dots.selectAll('*').remove();IE.tip.hide();});
};

/* ---------- column chart over time (one series; optional second series as a line) ---------- */
IE.colChart=function(el,o){
  const L=o.labels,idx=d3.range(L.length).filter(i=>o.vals[i]!=null&&isFinite(o.vals[i]));el.textContent='';if(!idx.length)return empty(el,o.empty);
  const a=idx[0],b=idx[idx.length-1],W=el.clientWidth||600,Ht=o.height||(W>640?360:300),m={t:o.bands&&o.bands.some(b=>b.label)?32:16,r:10,b:34,l:50};
  const vals=idx.map(i=>o.vals[i]);const y=d3.scaleLinear().domain([Math.min(0,d3.min(vals)),Math.max(0,d3.max(vals))]).nice(5).range([Ht-m.b,m.t]);
  const ticks=y.ticks(5),tf=IE.tickFmt(o.kind,Math.max(Math.abs(y.domain()[0]),Math.abs(y.domain()[1])));m.l=Math.max(44,d3.max(ticks,t=>tf(t).length)*8.6+10);
  const x=d3.scaleBand().domain(d3.range(a,b+1)).range([m.l,W-m.r]).paddingInner(.18),xc=i=>x(i)+x.bandwidth()/2;
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Column chart');
  yAxis(svg,y,ticks,tf,m,W);bands(svg.append('g'),xc,m.t,Ht-m.b,o.bands,x.step());
  svg.append('g').selectAll('rect').data(idx).join('rect').attr('x',i=>x(i)).attr('width',Math.max(1,x.bandwidth())).attr('y',i=>Math.min(y(0),y(o.vals[i]))).attr('height',i=>Math.max(1,Math.abs(y(o.vals[i])-y(0)))).attr('rx',Math.min(2,x.bandwidth()/3)).attr('fill',o.color||IE.PAL[0]);
  const xa=svg.append('g').attr('class','axis');IE.xTicks(L,a,b,W-m.l-m.r,o.align).forEach(i=>xa.append('text').attr('x',xc(i)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(o.tickLabel?o.tickLabel(i):L[i]));
  edgeFix(xa,W);
  const hl=svg.append('rect').attr('y',m.t).attr('height',Ht-m.t-m.b).attr('width',x.step()).attr('fill','#fff').attr('opacity',.12).style('display','none');
  const ov=svg.append('rect').attr('x',m.l).attr('y',m.t).attr('width',Math.max(0,W-m.l-m.r)).attr('height',Ht-m.t-m.b).attr('fill','transparent');
  function move(ev){const pt=d3.pointer(ev.touches?ev.touches[0]:ev,svg.node());const i=Math.max(a,Math.min(b,a+Math.floor((pt[0]-m.l)/x.step())));hl.style('display',null).attr('x',x(i)-x.step()*x.paddingInner()/2);
    IE.tip.show('<div class="t">'+esc(o.tipTitle?o.tipTitle(i):L[i])+'</div><div class="r"><span>'+IE.sw(o.color||IE.PAL[0])+esc(o.name||'Value')+'</span><b>'+IE.fmt(o.vals[i],o.kind)+'</b></div>'+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev);}
  ov.on('mousemove',move).on('touchstart',move,{passive:true}).on('touchmove',move,{passive:true}).on('mouseleave',()=>{hl.style('display','none');IE.tip.hide();});
};


/* ---------- daily/irregular columns with optional stacking and overlaid lines ----------
   o.labels; o.bars={vals,name,pos:{name,color},neg:{name,color}} or o.stack=[{name,color,vals}];
   o.lines=[{name,color,vals,width}]; o.ticks=[candidate tick indices]; o.tickLabel(i); o.tipTitle(i); o.fmt(v) */
IE.comboChart=function(el,o){
  const L=o.labels,n=L.length;el.textContent='';if(!n)return empty(el,o.empty);
  const W=el.clientWidth||600,Ht=o.height||(W>640?440:340),m={t:14,r:12,b:34,l:50},F=o.fmt||(v=>IE.fmt(v,o.kind));
  let lo=0,hi=0;
  if(o.stack){for(let i=0;i<n;i++){let p=0,q=0;o.stack.forEach(s=>{const v=s.vals[i];if(v>0)p+=v;else if(v<0)q+=v;});hi=Math.max(hi,p);lo=Math.min(lo,q);}}
  else o.bars.vals.forEach(v=>{if(v!=null){hi=Math.max(hi,v);lo=Math.min(lo,v);}});
  (o.lines||[]).forEach(l=>l.vals.forEach(v=>{if(v!=null){hi=Math.max(hi,v);lo=Math.min(lo,v);}}));
  const y=d3.scaleLinear().domain([lo,hi||1]).nice(6).range([Ht-m.b,m.t]),ticks=y.ticks(6);
  const tf=o.tickFmt||IE.tickFmt(o.kind,Math.max(Math.abs(y.domain()[0]),Math.abs(y.domain()[1])));m.l=Math.max(40,d3.max(ticks,t=>tf(t).length)*8.6+10);
  const x=d3.scaleBand().domain(d3.range(n)).range([m.l,W-m.r]).paddingInner(n>120?.15:.22),xc=i=>x(i)+x.bandwidth()/2,bw=Math.max(1,x.bandwidth());
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Chart');
  yAxis(svg,y,ticks,tf,m,W);
  const g=svg.append('g');
  if(o.stack){for(let i=0;i<n;i++){let p=0,q=0;o.stack.forEach(s=>{const v=s.vals[i];if(!v)return;const a=v>0?p:q,b=a+v;if(v>0)p=b;else q=b;
      g.append('rect').attr('x',x(i)).attr('width',bw).attr('y',y(Math.max(a,b))).attr('height',Math.max(.5,Math.abs(y(a)-y(b)))).attr('fill',s.color);});}}
  else g.selectAll('rect').data(d3.range(n).filter(i=>o.bars.vals[i]!=null)).join('rect').attr('x',i=>x(i)).attr('width',bw)
      .attr('y',i=>Math.min(y(0),y(o.bars.vals[i]))).attr('height',i=>Math.max(.5,Math.abs(y(o.bars.vals[i])-y(0)))).attr('fill',i=>o.bars.vals[i]>=0?o.bars.pos.color:o.bars.neg.color);
  svg.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',y(0)).attr('y2',y(0)).attr('stroke','#fff').attr('stroke-width',1);
  (o.lines||[]).forEach(l=>{const pts=d3.range(n).filter(i=>l.vals[i]!=null);svg.append('path').attr('d',d3.line().x(i=>xc(i)).y(i=>y(l.vals[i]))(pts)).attr('fill','none').attr('stroke',l.color).attr('stroke-width',l.width||2.5).attr('stroke-linejoin','round');});
  // x ticks: choose from candidates so labels never collide
  const cand=o.ticks||d3.range(n),lw=d3.max(cand,i=>String(o.tickLabel?o.tickLabel(i):L[i]).length)*8.4+14,fit=Math.max(1,Math.floor((W-m.l-m.r)/lw));
  const step=Math.ceil(cand.length/fit),xa=svg.append('g').attr('class','axis');
  cand.filter((c,k)=>k%step===0).forEach(i=>xa.append('text').attr('x',xc(i)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(o.tickLabel?o.tickLabel(i):L[i]));
  edgeFix(xa,W);
  const hl=svg.append('rect').attr('y',m.t).attr('height',Ht-m.t-m.b).attr('width',Math.max(2,x.step())).attr('fill','#fff').attr('opacity',.18).style('display','none');
  const ov=svg.append('rect').attr('x',m.l).attr('y',m.t).attr('width',Math.max(0,W-m.l-m.r)).attr('height',Ht-m.t-m.b).attr('fill','transparent');
  function move(ev){const pt=d3.pointer(ev.touches?ev.touches[0]:ev,svg.node());const i=Math.max(0,Math.min(n-1,Math.floor((pt[0]-m.l)/x.step())));hl.style('display',null).attr('x',x(i)-x.step()*x.paddingInner()/2);
    let r='';if(o.stack){let t=0;o.stack.forEach(s=>{const v=s.vals[i];if(v!=null)t+=v;r+='<div class="r"><span>'+IE.sw(s.color)+esc(s.name)+'</span><b>'+F(v)+'</b></div>';});r='<div class="r"><span>'+esc(o.totalName||'Total')+'</span><b>'+F(t)+'</b></div>'+r;}
    else{const v=o.bars.vals[i],k=v>=0?o.bars.pos:o.bars.neg;r='<div class="r"><span>'+IE.sw(k.color)+esc(k.name)+'</span><b>'+F(v)+'</b></div>';}
    (o.lines||[]).forEach(l=>{if(l.vals[i]!=null)r+='<div class="r"><span>'+IE.sw(l.color,1)+esc(l.name)+'</span><b>'+F(l.vals[i])+'</b></div>';});
    IE.tip.show('<div class="t">'+esc(o.tipTitle?o.tipTitle(i):L[i])+'</div>'+r+(o.extra?o.extra(i):'')+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev);}
  ov.on('mousemove',move).on('touchstart',move,{passive:true}).on('touchmove',move,{passive:true}).on('mouseleave',()=>{hl.style('display','none');IE.tip.hide();});
};

/* ---------- stacked columns over time ---------- */
IE.stackChart=function(el,o){
  const L=o.labels;el.textContent='';const yrs=d3.range(L.length).filter(i=>o.keys.some(k=>k.vals[i]!=null));if(!yrs.length)return empty(el,o.empty);
  const a=yrs[0],b=yrs[yrs.length-1],W=el.clientWidth||600,Ht=o.height||(W>640?380:320),m={t:16,r:8,b:34,l:50};
  const rows=d3.range(a,b+1).map(i=>{const r={i};o.keys.forEach((k,j)=>r[j]=k.vals[i]==null?0:k.vals[i]);return r;});
  const stk=d3.stack().keys(d3.range(o.keys.length)).offset(d3.stackOffsetDiverging)(rows);
  const lv=o.line?d3.range(a,b+1).map(i=>o.line.vals[i]).filter(v=>v!=null):[];const y=d3.scaleLinear().domain([Math.min(0,d3.min(stk,s=>d3.min(s,d=>d[0])),d3.min(lv)??0),Math.max(d3.max(stk,s=>d3.max(s,d=>d[1]))||1,d3.max(lv)??0)]).nice(5).range([Ht-m.b,m.t]);
  const ticks=y.ticks(5),tf=IE.tickFmt(o.kind,y.domain()[1]);m.l=Math.max(44,d3.max(ticks,t=>tf(t).length)*8.6+10);
  const x=d3.scaleBand().domain(d3.range(a,b+1)).range([m.l,W-m.r]).paddingInner(.14),xc=i=>x(i)+x.bandwidth()/2;
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Stacked columns');
  yAxis(svg,y,ticks,tf,m,W);
  stk.forEach((s,j)=>svg.append('g').selectAll('rect').data(s).join('rect').attr('x',d=>x(d.data.i)).attr('width',x.bandwidth()).attr('y',d=>y(Math.max(d[0],d[1]))+.5).attr('height',d=>Math.max(0,Math.abs(y(d[0])-y(d[1]))-1)).attr('fill',o.keys[j].color));
  if(o.line){const lp=d3.range(a,b+1).filter(i=>o.line.vals[i]!=null).map(i=>[xc(i),y(o.line.vals[i])]);
    svg.append('path').attr('d',d3.line()(lp)).attr('fill','none').attr('stroke',o.line.color||'#fff').attr('stroke-width',2.5).attr('stroke-linejoin','round');
    if(lp.length<=40)lp.forEach(q=>svg.append('circle').attr('cx',q[0]).attr('cy',q[1]).attr('r',3.5).attr('fill',o.line.color||'#fff').attr('stroke','#000').attr('stroke-width',1.5));}
  const xa=svg.append('g').attr('class','axis');IE.xTicks(L,a,b,W-m.l-m.r,o.align,o.minStep).forEach(i=>xa.append('text').attr('x',xc(i)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(o.tickLabel?o.tickLabel(i):L[i]));
  edgeFix(xa,W);
  const hl=svg.append('rect').attr('y',m.t).attr('height',Ht-m.t-m.b).attr('width',x.step()).attr('fill','#fff').attr('opacity',.1).style('display','none');
  const ov=svg.append('rect').attr('x',m.l).attr('y',m.t).attr('width',Math.max(0,W-m.l-m.r)).attr('height',Ht-m.t-m.b).attr('fill','transparent');
  function move(ev){const pt=d3.pointer(ev.touches?ev.touches[0]:ev,svg.node());const i=Math.max(a,Math.min(b,a+Math.floor((pt[0]-m.l)/x.step())));hl.style('display',null).attr('x',x(i)-x.step()*x.paddingInner()/2);
    let tot=0;const r=o.keys.map(k=>{const v=k.vals[i];if(v!=null)tot+=v;return '<div class="r"><span>'+IE.sw(k.color)+esc(k.name)+'</span><b>'+IE.fmt(v,o.kind)+'</b></div>';}).reverse().join('');
    IE.tip.show('<div class="t">'+esc(o.tipTitle?o.tipTitle(i):L[i])+'</div>'+r+(o.line&&o.line.vals[i]!=null?'<div class="r" style="border-top:1px solid #444;margin-top:4px;padding-top:4px"><span>'+IE.sw(o.line.color||'#fff',1)+esc(o.line.name)+'</span><b>'+IE.fmt(o.line.vals[i],o.line.kind||o.kind)+'</b></div>':'')+(o.noTotal?'':'<div class="r" style="border-top:1px solid #444;margin-top:4px;padding-top:4px"><span>'+esc(o.totalName||'Total')+'</span><b>'+IE.fmt(o.total?o.total[i]:tot,o.kind)+'</b></div>')+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev);}
  ov.on('mousemove',move).on('touchstart',move,{passive:true}).on('touchmove',move,{passive:true}).on('mouseleave',()=>{hl.style('display','none');IE.tip.hide();});
};

/* ---------- ranked horizontal bars ---------- */
IE.rankBars=function(el,o){
  el.textContent='';const items=o.items.filter(d=>d.v!=null&&isFinite(d.v));if(!items.length)return empty(el,o.empty);
  if(!o.keep)items.sort((p,q)=>q.v-p.v);
  const W=el.clientWidth||500,rh=o.rh||27,lw=o.lw||Math.min(220,W*(W<520?.5:.38)),vw=Math.min(130,d3.max(items,d=>IE.fmt(d.v,o.kind).length)*8.8+8);
  const Ht=items.length*rh+8,ext=[Math.min(0,d3.min(items,d=>Math.min(d.v,d.ref==null?d.v:d.ref))),Math.max(0,d3.max(items,d=>Math.max(d.v,d.ref==null?d.v:d.ref)))];
  const neg=ext[0]<0,x=d3.scaleLinear().domain(ext).range([lw+(neg?vw:0),W-vw]);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Ranked bars');
  svg.append('line').attr('x1',x(0)).attr('x2',x(0)).attr('y1',0).attr('y2',Ht).attr('stroke','#666');
  items.forEach((d,i)=>{const yy=i*rh+4,g=svg.append('g').style('cursor',o.onClick?'pointer':null);
    g.append('rect').attr('x',0).attr('y',yy-2).attr('width',W).attr('height',rh).attr('fill','transparent');
    let nm=d.name;const maxc=Math.floor((lw-10)/8.6);if(nm.length>maxc)nm=nm.slice(0,maxc-1)+'…';
    g.append('text').attr('x',lw-8).attr('y',yy+rh/2+2).attr('text-anchor','end').attr('font-size',15).attr('font-weight',d.hl?600:400).text(nm);
    const x0=Math.min(x(0),x(d.v)),bw=Math.abs(x(d.v)-x(0));
    g.append('rect').attr('x',x0).attr('y',yy+3).attr('width',Math.max(1,bw)).attr('height',rh-10).attr('rx',3).attr('fill',d.color||o.color||IE.PAL[0]);
    if(d.ref!=null)g.append('line').attr('x1',x(d.ref)).attr('x2',x(d.ref)).attr('y1',yy).attr('y2',yy+rh-4).attr('stroke','#fff').attr('stroke-width',2.5);
    g.append('text').attr('x',d.v<0?x(d.v)-6:x(d.v)+6).attr('y',yy+rh/2+2).attr('text-anchor',d.v<0?'end':'start').attr('font-size',15).text(IE.fmt(d.v,o.kind));
    g.on('mousemove',ev=>IE.tip.show('<div class="t">'+esc(d.full||d.name)+'</div><div class="r"><span>'+esc(o.vname||'Value')+'</span><b>'+IE.fmt(d.v,o.kind)+'</b></div>'+(d.ref!=null?'<div class="r"><span>'+esc(o.rname||'Reference')+'</span><b>'+IE.fmt(d.ref,o.kind)+'</b></div>':'')+(d.extra||'')+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev)).on('mouseleave',IE.tip.hide);
    if(o.onClick)g.on('click',()=>o.onClick(d));});
};

/* ---------- sparkline ---------- */
IE.spark=function(vals){const pts=vals.map((v,i)=>[i,v]).filter(p=>p[1]!=null);if(pts.length<2)return '';const W=180,Ht=38,x=d3.scaleLinear().domain([0,vals.length-1]).range([3,W-5]),e=d3.extent(pts,p=>p[1]),y=d3.scaleLinear().domain(e[0]===e[1]?[e[0]-1,e[1]+1]:e).range([Ht-4,4]);
  const l=d3.line().x(p=>x(p[0])).y(p=>y(p[1]))(pts),z=pts[pts.length-1];const zero=e[0]<0&&e[1]>0?'<line x1="3" x2="'+(W-5)+'" y1="'+y(0)+'" y2="'+y(0)+'" stroke="#555"/>':'';
  return '<svg viewBox="0 0 '+W+' '+Ht+'" width="'+W+'" height="'+Ht+'" style="max-width:100%;height:auto;display:block" aria-hidden="true">'+zero+'<path d="'+l+'" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="'+x(z[0])+'" cy="'+y(z[1])+'" r="3.5" fill="#fff"/></svg>';};

/* ---------- map colour classes: sequential (one hue) or diverging (cyan below zero, pink above) ---------- */
const SEQ=['#12333b','#1d5562','#2f7b8c','#4ea3b6','#7fcfe2','#c4f1fb'],DIVC=['#c4f1fb','#63b8cb','#28606c','#6e2f55','#c56a9f','#fbc4e3'];
IE.classer=function(values,div){
  const v=values.filter(x=>x!=null&&isFinite(x)).sort(d3.ascending);if(!v.length)return null;
  if(div){const ab=(div.pool||v).map(Math.abs).filter(x=>x>0).sort(d3.ascending);let b1=d3.quantile(ab,.4)||1,b2=d3.quantile(ab,.8)||2;if(b2<=b1)b2=b1*2;
    const th=[-b2,-b1,0,b1,b2];return {th,cols:DIVC,div:true,f:x=>x===0?'#5a5a5a':DIVC[d3.bisectRight(th,x)]};}
  const th=[1,2,3,4,5].map(k=>d3.quantile(v,k/6));const u=th.filter((t,i)=>i===0||t>th[i-1]);const cols=SEQ.slice(SEQ.length-(u.length+1));
  return {th:u,cols,f:x=>cols[d3.bisectRight(u,x)]};
};
IE.scaleLegend=function(c,kind){const d=h('div',{class:'legend'});const F=v=>IE.fmt(v,kind);
  const L=c.div?['below '+F(c.th[0]),F(c.th[0])+' to '+F(c.th[1]),F(c.th[1])+' to 0','0 to '+F(c.th[3]),F(c.th[3])+' to '+F(c.th[4]),F(c.th[4])+' and above']
    :c.cols.map((col,i)=>{const lo=i?F(c.th[i-1]):null,hi=i<c.th.length?F(c.th[i]):null;return lo==null?'below '+hi:hi==null?lo+' and above':lo+' to '+hi;});
  c.cols.forEach((col,i)=>d.appendChild(h('span',{html:IE.sw(col)+esc(L[i])})));d.appendChild(h('span',{html:'<i class="sw" style="background:#161616;border:1px solid #555"></i>no data'}));return d;};

/* ---------- India state map (needs topojson + window.GEO) ---------- */
IE.mapChart=function(el,o){
  el.textContent='';const FEAT=topojson.feature(window.GEO,window.GEO.objects.states).features;
  const W=el.clientWidth||520,Ht=Math.min(680,W*1.08),proj=d3.geoMercator().fitExtent([[4,4],[W-4,Ht-4]],{type:'FeatureCollection',features:FEAT}),path=d3.geoPath(proj);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Map of India by state');
  const look=f=>o.lookup?o.lookup(f.properties.n):f.properties.n;
  svg.selectAll('path').data(FEAT).join('path').attr('d',path).attr('fill',f=>{const v=o.values[look(f)];return v==null||!o.cl?'#161616':o.cl.f(v);}).attr('stroke','#000').attr('stroke-width',.8)
    .style('cursor',f=>o.onClick&&o.values[look(f)]!=null?'pointer':null)
    .on('mousemove',function(ev,f){const n=look(f),v=o.values[n];d3.select(this).attr('stroke','#fff').attr('stroke-width',1.6).raise();
      IE.tip.show('<div class="t">'+esc(f.properties.n)+(n!==f.properties.n?' (data for '+esc(n)+')':'')+'</div><div class="r"><span>'+esc(o.title||'')+'</span><b>'+IE.fmt(v,o.kind)+'</b></div>'+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev);})
    .on('mouseleave',function(){d3.select(this).attr('stroke','#000').attr('stroke-width',.8);IE.tip.hide();})
    .on('click',(ev,f)=>{const n=look(f);if(o.onClick&&o.values[n]!=null)o.onClick(n);});
};

/* ---------- simple view router on #hash ---------- */
IE.router=function(views,start,render){let cur=(location.hash||'').slice(1);if(!views.some(v=>v[0]===cur))cur=start;
  const api={get:()=>cur,go(v){cur=v;try{history.replaceState(null,'','#'+v);}catch(e){location.hash=v;}render();window.scrollTo(0,0);},
    tabs(el){el.textContent='';views.forEach(([id,n])=>el.appendChild(h('a',{href:'#'+id,text:n,'aria-current':cur===id?'page':null,onclick:e=>{e.preventDefault();api.go(id);}})));}};
  window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(views.some(x=>x[0]===v)&&v!==cur){cur=v;render();}});
  let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(render,180);});
  return api;};

IE.store={get(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
window.IE=IE;
})();
