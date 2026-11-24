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
    case 'pct2':return (a>=100?v.toFixed(0):a>=10?v.toFixed(1):v.toFixed(2)).replace(/^-/,'−')+'%';  // two decimals below 10%, for small ratios
    case 'pctx':return v.toFixed(2).replace(/^-/,'−')+'%';  // always two decimals, as MoSPI publishes CPI rates
    case 'pct':return (a>=100?v.toFixed(0):a>=1||a===0?v.toFixed(1):v.toFixed(2)).replace(/^-/,'−')+'%';
    case 'pp':return (v>0?'+':'')+v.toFixed(1).replace(/^-/,'−')+' pp';
    case 'idx':return v.toFixed(1);
    case 'rs':return (v<0?'−':'')+'₹'+IE.IN(Math.round(a));
    case 'pop':
    case 'num':return a>=1e7?(v/1e7).toFixed(2)+' crore':a>=1e5?(v/1e5).toFixed(2)+' lakh':IE.IN(Math.round(v));
    case 'cr':return (v<0?'−':'')+(a>=1e5?'₹'+(a/1e5).toFixed(2)+' lakh cr':a>=100?'₹'+IE.IN(Math.round(a))+' cr':'₹'+a.toFixed(2)+' cr');
    case 'x':return v.toFixed(2);
    default:return IE.IN(v,a<10?2:0);
  }
};
IE.tickFmt=function(kind,max,step){const dp=step==null?null:step>=1?0:step>=.1?1:2;
  if(kind==='pct'||kind==='pct2'||kind==='pctx')return v=>d3.format('.'+(dp==null?(max<5?1:0):dp)+'f')(v).replace('-','−')+'%';
  if(kind==='idx'||kind==='x')return d3.format(max<5?'.1f':'.0f');
  if(kind==='pp')return v=>d3.format(max<5?'.1f':'.0f')(v).replace('-','−');
  if(kind==='rs')return v=>max>=2e5?'₹'+d3.format('.1f')(v/1e5)+'L':'₹'+IE.IN(v);
  if(kind==='num'||kind==='pop')return v=>max>=1e7?d3.format('.1f')(v/1e7)+' cr':max>=1e5?d3.format(max<1e6?'.1f':'.0f')(v/1e5)+' lakh':IE.IN(v);
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
/* single-year slider. opts.play adds a Play button that steps through the years (IE.stopPlay() halts it) */
let playT=null;IE.stopPlay=()=>{if(playT){clearInterval(playT);playT=null;}};IE.playing=()=>!!playT;
IE.yearCtl=function(labels,idx,on,tagFn,opts){
  const lab=h('span',{class:'yearval',text:labels[idx]}),tg=h('span',{class:'tag',text:tagFn?tagFn(idx):''});if(!tagFn)tg.style.display='none';
  const r=h('input',{type:'range',min:0,max:labels.length-1,step:1,value:idx,'aria-label':'Year'});r.id='yr'+(++uid);
  const set=i=>{r.value=i;lab.textContent=labels[i];if(tagFn)tg.textContent=tagFn(i);on(i);};
  r.addEventListener('input',()=>set(+r.value));
  const box=h('div',{style:'display:flex;align-items:center;gap:12px;flex-wrap:wrap'},[r,h('span',null,[lab,tg])]);
  if(opts&&opts.play){const n=labels.length,pb=h('button',{class:'sm',text:'Play'});
    pb.addEventListener('click',()=>{if(playT){IE.stopPlay();pb.textContent='Play';return;}pb.textContent='Stop';let i=+r.value;if(i>=n-1)set(i=0);
      playT=setInterval(()=>{if(i>=n-1||!document.body.contains(pb)){IE.stopPlay();pb.textContent='Play';return;}set(++i);},opts.ms||700);});
    box.appendChild(pb);}
  return h('div',{class:'ctl'},[h('label',{for:r.id,text:opts&&opts.label||'Year'}),box]);
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
IE.YEAR_STEPS=[1,2,5,10,20,25,50];
IE.xTicks=function(labels,a,b,pw,align,minStep,steps0){
  align=align||(i=>i);const lw=d3.max(labels.slice(a,b+1),l=>String(l).length)*8.4+14;const fit=Math.max(1,Math.floor(pw/lw));
  const steps=(steps0||[1,2,3,4,6,12,24,36,48,60,120,240]).filter(s=>s>=(minStep||1)),idx=d3.range(a,b+1);
  for(const s of steps){let best=null;
    for(let off=0;off<(steps0?1:s);off++){/* year steps stay on round years; other steps may shift to fit more labels */const t=idx.filter(i=>((align(i)-off)%s+s)%s===0);if(t.length<=fit&&(!best||t.length>best.length))best=t;}
    if(best&&best.length)return best;}
  return [a];
};
function edgeFix(xa,W){xa.selectAll('text').each(function(){const b=this.getBBox();if(b.x+b.width>W-1){d3.select(this).attr('text-anchor','end').attr('x',W-1);}else if(b.x<1){d3.select(this).attr('text-anchor','start').attr('x',1);}});}
/* shaded period bands, e.g. estimates not yet audited: [{from,to,label,op}] in label indices */
function bands(g,x,y0,y1,list,bw,a,b){let last=-1e9,up=false;(list||[]).forEach(bd=>{
  const f=a==null?bd.from:Math.max(a,bd.from),t=b==null?bd.to:Math.min(b,bd.to);if(f>t)return;
  const x0=x(f)-bw/2,x1=x(t)+bw/2;g.append('rect').attr('x',x0).attr('y',y0).attr('width',Math.max(2,x1-x0)).attr('height',y1-y0).attr('fill','#fff').attr('opacity',bd.op||.08);
  if(bd.label){const cx=(x0+x1)/2;up=cx-last<34?!up:false;last=cx;g.append('text').attr('x',cx).attr('y',y0-(up?19:6)).attr('text-anchor','middle').attr('font-size',12).attr('fill',AX).text(bd.label);}});}
const bandTop=o=>o.bands&&o.bands.some(b=>b.label)?36:16;
function yAxis(svg,y,ticks,tf,m,W){const gg=svg.append('g').attr('class','gridl');ticks.forEach(t=>gg.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',y(t)).attr('y2',y(t)));
  const ya=svg.append('g').attr('class','axis');ticks.forEach(t=>ya.append('text').attr('x',m.l-8).attr('y',y(t)+5).attr('text-anchor','end').text(tf(t)));
  if(y.domain()[0]<0&&y.domain()[1]>0)svg.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',y(0)).attr('y2',y(0)).attr('stroke','#888');}
function empty(el,msg){el.textContent='';el.appendChild(h('p',{class:'empty',text:msg||'No data for this selection.'}));}

/* ---------- line chart ---------- */
/* ---------- every chart inside a .card gets a "Copy as CSV" button that copies exactly the numbers it draws.
   A card with data-nocsv gets none. Several charts in one card are copied one after another. ---------- */
const cnum=v=>v==null||!isFinite(v)?null:Math.round(v*1e6)/1e6;
const colHead=(o,first)=>(first||'Period')+(o.unit?' ('+o.unit+')':'');
function csvOf(el,head,rows){if(!el)return;el.__csv=rows.length?{head,rows}:null;
  const go=()=>{const card=el.closest&&el.closest('.card');if(!card)return;
    /* a null header means "use the card's title" */
    if(el.__csv){const t=((card.querySelector('h3')||{}).textContent||'Value').trim().replace(/^Ranking:\s*/,'');el.__csv.head=el.__csv.head.map(x=>x==null?t:x);}
    if(card.hasAttribute('data-nocsv'))return;const had=card.querySelector(':scope>.csvrow');if(had){card.appendChild(had);return;}/* keep the button last, below any notes */
    card.appendChild(h('div',{class:'csvrow'},[IE.copyBtn(()=>[...card.querySelectorAll('*')].map(e=>e.__csv).filter(Boolean).map(d=>IE.toCSV(d.head,d.rows)).join('\n\n'))]));};
  setTimeout(go,0);}
function seriesCSV(el,o,list){const L=o.labels||[];list=(list||[]).filter(Boolean);
  const ix=[...new Set(list.flatMap(s=>(s.pts||[]).filter(p=>p[1]!=null&&isFinite(p[1])).map(p=>p[0])))].sort((a,b)=>a-b),mp=list.map(s=>new Map((s.pts||[]).map(p=>[p[0],p[1]])));
  csvOf(el,[colHead(o)].concat(list.map(s=>s.name||'Value')),ix.map(i=>[o.tipTitle?o.tipTitle(i):L[i]].concat(mp.map(m=>cnum(m.get(i))))));}
const vpts=vals=>(vals||[]).map((v,i)=>[i,v]);
IE.csvOf=csvOf;
IE.lineChart=function(el,o){
  seriesCSV(el,o,o.series);
  const L=o.labels,series=o.series.map(s=>Object.assign({},s,{pts:s.pts.filter(p=>p[1]!=null&&isFinite(p[1]))})).filter(s=>s.pts.length);
  el.textContent='';if(!series.length)return empty(el,o.empty);
  const W=el.clientWidth||600,wide=W>640,end=wide&&o.endLabels!==false&&series.length>1,Ht=o.height||(wide?420:330);
  const m={t:bandTop(o),r:end?168:16,b:34,l:10};
  const all=series.flatMap(s=>s.pts);let a=d3.min(all,p=>p[0]),b=d3.max(all,p=>p[0]);if(a===b){a=Math.max(0,a-1);b=Math.min(L.length-1,b+1);}
  let lo=d3.min(all,p=>p[1]),hi=d3.max(all,p=>p[1]);if(o.zero!==false&&o.kind!=='idx'){lo=Math.min(0,lo);hi=Math.max(0,hi);}(o.hlines||[]).forEach(r=>{lo=Math.min(lo,r.v);hi=Math.max(hi,r.v);});if(lo===hi){lo-=1;hi+=1;}
  const y=d3.scaleLinear().domain([lo,hi]).nice(6).range([Ht-m.b,m.t]);const ticks=y.ticks(6),tf=IE.tickFmt(o.kind,Math.max(Math.abs(y.domain()[0]),Math.abs(y.domain()[1])),ticks.length>1?ticks[1]-ticks[0]:null);
  m.l=Math.max(44,d3.max(ticks,t=>tf(t).length)*8.6+10);
  const x=d3.scaleLinear().domain([a,b]).range([m.l+8,W-m.r-8]);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Line chart');
  yAxis(svg,y,ticks,tf,m,W);
  const xa=svg.append('g').attr('class','axis');IE.xTicks(L,a,b,W-m.l-m.r-16,o.align,o.minStep,o.steps).forEach(i=>xa.append('text').attr('x',x(i)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(o.tickLabel?o.tickLabel(i):L[i]));
  edgeFix(xa,W);
  bands(svg.append('g'),x,m.t,Ht-m.b,o.bands,(x(a+1)-x(a))||10,a,b);
  /* o.hlines: [{v,label,short}] (short on phones) dashed reference lines, labelled at the left */
  (o.hlines||[]).forEach(r=>{svg.append('line').attr('x1',m.l+8).attr('x2',W-m.r-8).attr('y1',y(r.v)).attr('y2',y(r.v)).attr('stroke','#9a9a9a').attr('stroke-width',1.5).attr('stroke-dasharray','6 5');
    /* put the label above the line where no data point overlaps it */
    const lab=(!wide&&r.short)||r.label,fs=wide?14:13,lw=lab?lab.length*fs*.54+8:0,yy=y(r.v),pts=series.flatMap(s=>s.pts.flatMap((p,i)=>{const q=s.pts[i+1];return q&&q[0]===p[0]+1?d3.range(8).map(k=>[x(p[0]+k/8),y(p[1]+(q[1]-p[1])*k/8)]):[[x(p[0]),y(p[1])]];})),x0=m.l+12,x1=W-m.r-8-lw;
    series.forEach(s=>{if(!s.endValue)return;const e=s.pts[s.pts.length-1],ex=x(e[0]),ey=y(e[1])-14,tw=IE.fmt(e[1],o.kind==='pct'?'pct2':o.kind).length*11;for(let k=0;k<=tw;k+=6)for(let j=-18;j<=4;j+=4)pts.push([ex-k,ey+j]);});
    let best=null;[[-24,4,-7],[-4,24,17]].forEach(([u,d,ty])=>{for(let f=0;f<=1.0001;f+=.02){const c=x0+(x1-x0)*f,n=pts.filter(p=>p[0]>=c-8&&p[0]<=c+lw+8&&p[1]>=yy+u&&p[1]<=yy+d).length;if(!best||n<best.n)best={n,c,ty};if(!n)break;}});
    if(lab)svg.append('text').attr('x',best.c).attr('y',yy+best.ty).attr('font-size',fs).style('fill','rgba(255,255,255,.78)').text(lab);});
  const ln=d3.line().x(p=>x(p[0])).y(p=>y(p[1]));
  series.forEach(s=>{const segs=[];let cur=[];s.pts.forEach((p,i)=>{if(i&&p[0]!==s.pts[i-1][0]+1){segs.push(cur);cur=[];}cur.push(p);});segs.push(cur);
    segs.forEach(sg=>{if(sg.length>1)svg.append('path').attr('d',ln(sg)).attr('fill','none').attr('stroke',s.color).attr('stroke-width',s.bold?3:2).attr('stroke-dasharray',s.dash||null).attr('stroke-linejoin','round');
      else svg.append('circle').attr('cx',x(sg[0][0])).attr('cy',y(sg[0][1])).attr('r',3).attr('fill',s.color);});
    const e=s.pts[s.pts.length-1];svg.append('circle').attr('cx',x(e[0])).attr('cy',y(e[1])).attr('r',4.5).attr('fill',s.color).attr('stroke','#000').attr('stroke-width',2);
    /* s.endValue: print the latest value above its point */
    if(s.endValue)svg.append('text').attr('x',x(e[0])).attr('y',y(e[1])-14).attr('text-anchor','end').attr('font-size',20).attr('font-weight',600).style('paint-order','stroke').style('stroke','#0e0e0e').style('stroke-width',5).text(IE.fmt(e[1],o.kind==='pct'?'pct2':o.kind));});
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

/* ---------- grouped bars over time, with optional overlaid lines (used for growth rates) ---------- */
IE.barChart=function(el,o){
  seriesCSV(el,o,(o.series||[]).concat(o.lines||[]));
  const L=o.labels,clean=s=>Object.assign({},s,{pts:s.pts.filter(p=>p[1]!=null&&isFinite(p[1]))});
  const bars=(o.series||[]).map(clean).filter(s=>s.pts.length),lines=(o.lines||[]).map(clean).filter(s=>s.pts.length);
  el.textContent='';if(!bars.length&&!lines.length)return empty(el,o.empty);
  const all=bars.concat(lines).flatMap(s=>s.pts),a=d3.min(all,p=>p[0]),b=d3.max(all,p=>p[0]);
  const W=el.clientWidth||600,Ht=o.height||(W>640?400:320),m={t:bandTop(o),r:10,b:34,l:50};
  const y=d3.scaleLinear().domain([Math.min(0,d3.min(all,p=>p[1])),Math.max(0,d3.max(all,p=>p[1]))]).nice(6).range([Ht-m.b,m.t]);
  const ticks=y.ticks(6),tf=IE.tickFmt(o.kind,Math.max(Math.abs(y.domain()[0]),Math.abs(y.domain()[1])),ticks.length>1?ticks[1]-ticks[0]:null);m.l=Math.max(44,d3.max(ticks,t=>tf(t).length)*8.6+10);
  const x=d3.scaleBand().domain(d3.range(a,b+1)).range([m.l,W-m.r]).paddingInner(bars.length>1?.22:.18),xc=i=>x(i)+x.bandwidth()/2;
  const xi=d3.scaleBand().domain(d3.range(Math.max(1,bars.length))).range([0,x.bandwidth()]).paddingInner(bars.length>1?.08:0);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Bar chart');
  yAxis(svg,y,ticks,tf,m,W);bands(svg.append('g'),xc,m.t,Ht-m.b,o.bands,x.step(),a,b);
  const bw=Math.max(1,xi.bandwidth()),rx=Math.min(2,bw/3);
  bars.forEach((s,k)=>svg.append('g').selectAll('rect').data(s.pts).join('rect').attr('x',p=>x(p[0])+xi(k)).attr('width',bw)
    .attr('y',p=>Math.min(y(0),y(p[1]))).attr('height',p=>Math.max(1,Math.abs(y(p[1])-y(0)))).attr('rx',rx).attr('fill',s.color));
  svg.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',y(0)).attr('y2',y(0)).attr('stroke','#fff').attr('stroke-opacity',.7);
  const ln=d3.line().x(p=>xc(p[0])).y(p=>y(p[1]));
  lines.forEach(s=>{const segs=[];let cur=[];s.pts.forEach((p,i)=>{if(i&&p[0]!==s.pts[i-1][0]+1){segs.push(cur);cur=[];}cur.push(p);});segs.push(cur);
    segs.forEach(sg=>{if(sg.length>1)svg.append('path').attr('d',ln(sg)).attr('fill','none').attr('stroke',s.color).attr('stroke-width',2.5).attr('stroke-dasharray',s.dash||null).attr('stroke-linejoin','round');});
    if(s.pts.length<=40)s.pts.forEach(p=>svg.append('circle').attr('cx',xc(p[0])).attr('cy',y(p[1])).attr('r',3.5).attr('fill',s.color).attr('stroke','#000').attr('stroke-width',1.5));});
  const xa=svg.append('g').attr('class','axis');IE.xTicks(L,a,b,W-m.l-m.r,o.align,o.minStep,o.steps).forEach(i=>xa.append('text').attr('x',xc(i)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(o.tickLabel?o.tickLabel(i):L[i]));
  edgeFix(xa,W);
  const hl=svg.insert('rect',':first-child').attr('y',m.t).attr('height',Ht-m.t-m.b).attr('width',x.step()).attr('fill','#fff').attr('opacity',.1).style('display','none');
  const ov=svg.append('rect').attr('x',m.l).attr('y',m.t).attr('width',Math.max(0,W-m.l-m.r)).attr('height',Ht-m.t-m.b).attr('fill','transparent');
  function move(ev){const pt=d3.pointer(ev.touches?ev.touches[0]:ev,svg.node());const i=Math.max(a,Math.min(b,a+Math.floor((pt[0]-m.l)/x.step())));hl.style('display',null).attr('x',x(i)-x.step()*x.paddingInner()/2);
    const row=(s,ln)=>{const p=s.pts.find(q=>q[0]===i);return p?'<div class="r"><span>'+IE.sw(s.color,ln)+esc(s.name)+'</span><b>'+IE.fmt(p[1],o.kind)+'</b></div>':'';};
    IE.tip.show('<div class="t">'+esc(o.tipTitle?o.tipTitle(i):L[i])+'</div>'+bars.map(s=>row(s,0)).join('')+lines.map(s=>row(s,1)).join('')+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev);}
  ov.on('mousemove',move).on('touchstart',move,{passive:true}).on('touchmove',move,{passive:true}).on('mouseleave',()=>{hl.style('display','none');IE.tip.hide();});
};

/* ---------- growth-rate chart with a Bars | Lines switch ----------
   Every series on the chart (o.series, then o.lines) is drawn as bars or as lines, as the reader chooses.
   The choice is remembered across the site; until the reader chooses, bars are used when they stay readable. */
const GROWTH=[];
IE.growthChart=function(host,o){
  host.textContent='';const top=h('div',{class:'gc-top'}),plot=h('div');host.appendChild(top);host.appendChild(plot);
  const all=(o.series||[]).concat(o.lines||[]).filter(s=>s.pts.some(p=>p[1]!=null&&isFinite(p[1])));
  const rec={host,draw};GROWTH.push(rec);
  function auto(){if(!all.length||all.length>3)return 'lines';
    const idx=all.flatMap(s=>s.pts.filter(p=>p[1]!=null).map(p=>p[0])),n=d3.max(idx)-d3.min(idx)+1,pw=(host.clientWidth||600)-60;return pw/(n*(all.length+.3))>=2.5?'bars':'lines';}
  function draw(){const style=IE.store.get('ie-growth-style',null)||auto(),bars=style==='bars';top.textContent='';
    const leg=h('div',{class:'legend',html:all.length>1?all.map(s=>'<span>'+IE.sw(s.color,!bars)+esc(s.name)+'</span>').join(''):''});
    const sw=IE.seg([['bars','Bars'],['lines','Lines']],style,v=>{IE.store.set('ie-growth-style',v);GROWTH.splice(0,GROWTH.length,...GROWTH.filter(r=>document.body.contains(r.host)));GROWTH.forEach(r=>r.draw());});
    sw.classList.add('gc-switch');sw.setAttribute('aria-label','Show as bars or lines');top.appendChild(leg);top.appendChild(sw);
    if(bars)IE.barChart(plot,Object.assign({},o,{series:all,lines:null}));
    else IE.lineChart(plot,Object.assign({},o,{endLabels:false,series:all}));}
  draw();
};

/* ---------- column chart over time (one series; optional second series as a line) ---------- */
IE.colChart=function(el,o){
  seriesCSV(el,o,[{name:o.name||'Value',pts:vpts(o.vals)}]);
  const L=o.labels,idx=d3.range(L.length).filter(i=>o.vals[i]!=null&&isFinite(o.vals[i]));el.textContent='';if(!idx.length)return empty(el,o.empty);
  const a=idx[0],b=idx[idx.length-1],W=el.clientWidth||600,Ht=o.height||(W>640?360:300),m={t:bandTop(o),r:10,b:34,l:50};
  const vals=idx.map(i=>o.vals[i]);const y=d3.scaleLinear().domain([Math.min(0,d3.min(vals)),Math.max(0,d3.max(vals))]).nice(5).range([Ht-m.b,m.t]);
  const ticks=y.ticks(5),tf=IE.tickFmt(o.kind,Math.max(Math.abs(y.domain()[0]),Math.abs(y.domain()[1])),ticks.length>1?ticks[1]-ticks[0]:null);m.l=Math.max(44,d3.max(ticks,t=>tf(t).length)*8.6+10);
  const x=d3.scaleBand().domain(d3.range(a,b+1)).range([m.l,W-m.r]).paddingInner(.18),xc=i=>x(i)+x.bandwidth()/2;
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Column chart');
  yAxis(svg,y,ticks,tf,m,W);bands(svg.append('g'),xc,m.t,Ht-m.b,o.bands,x.step(),a,b);
  svg.append('g').selectAll('rect').data(idx).join('rect').attr('x',i=>x(i)).attr('width',Math.max(1,x.bandwidth())).attr('y',i=>Math.min(y(0),y(o.vals[i]))).attr('height',i=>Math.max(1,Math.abs(y(o.vals[i])-y(0)))).attr('rx',Math.min(2,x.bandwidth()/3)).attr('fill',o.color||IE.PAL[0]);
  const xa=svg.append('g').attr('class','axis');IE.xTicks(L,a,b,W-m.l-m.r,o.align,o.minStep,o.steps).forEach(i=>xa.append('text').attr('x',xc(i)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(o.tickLabel?o.tickLabel(i):L[i]));
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
  seriesCSV(el,o,(o.stack?o.stack.map(s=>({name:s.name,pts:vpts(s.vals)})):[{name:o.barName||o.totalName||'Value',pts:vpts(o.bars&&o.bars.vals)}]).concat((o.lines||[]).map(l=>({name:l.name,pts:vpts(l.vals)}))));
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
  seriesCSV(el,o,o.keys.map(k=>({name:k.name,pts:vpts(k.vals)})).concat(o.line?[{name:o.line.name||o.totalName||'Total',pts:vpts(o.line.vals)}]:[]));
  const L=o.labels;el.textContent='';const yrs=d3.range(L.length).filter(i=>o.keys.some(k=>k.vals[i]!=null));if(!yrs.length)return empty(el,o.empty);
  const a=yrs[0],b=yrs[yrs.length-1],W=el.clientWidth||600,Ht=o.height||(W>640?380:320),m={t:bandTop(o),r:8,b:34,l:50};
  const rows=d3.range(a,b+1).map(i=>{const r={i};o.keys.forEach((k,j)=>r[j]=k.vals[i]==null?0:k.vals[i]);return r;});
  const stk=d3.stack().keys(d3.range(o.keys.length)).offset(d3.stackOffsetDiverging)(rows);
  const lv=o.line?d3.range(a,b+1).map(i=>o.line.vals[i]).filter(v=>v!=null):[];const y=d3.scaleLinear().domain([Math.min(0,d3.min(stk,s=>d3.min(s,d=>d[0])),d3.min(lv)??0),Math.max(d3.max(stk,s=>d3.max(s,d=>d[1]))||1,d3.max(lv)??0)]).nice(5).range([Ht-m.b,m.t]);if(o.max!=null&&y.domain()[1]>o.max)y.domain([y.domain()[0],o.max]);
  const ticks=y.ticks(5),tf=IE.tickFmt(o.kind,y.domain()[1],ticks.length>1?ticks[1]-ticks[0]:null);m.l=Math.max(44,d3.max(ticks,t=>tf(t).length)*8.6+10);
  const x=d3.scaleBand().domain(d3.range(a,b+1)).range([m.l,W-m.r]).paddingInner(.14),xc=i=>x(i)+x.bandwidth()/2;
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Stacked columns');
  yAxis(svg,y,ticks,tf,m,W);bands(svg.append('g'),xc,m.t,Ht-m.b,o.bands,x.step(),a,b);
  stk.forEach((s,j)=>svg.append('g').selectAll('rect').data(s).join('rect').attr('x',d=>x(d.data.i)).attr('width',x.bandwidth()).attr('y',d=>y(Math.max(d[0],d[1]))+.5).attr('height',d=>Math.max(0,Math.abs(y(d[0])-y(d[1]))-1)).attr('fill',o.keys[j].color));
  if(o.line){const lp=d3.range(a,b+1).filter(i=>o.line.vals[i]!=null).map(i=>[xc(i),y(o.line.vals[i])]);
    svg.append('path').attr('d',d3.line()(lp)).attr('fill','none').attr('stroke',o.line.color||'#fff').attr('stroke-width',2.5).attr('stroke-linejoin','round');
    if(lp.length<=40)lp.forEach(q=>svg.append('circle').attr('cx',q[0]).attr('cy',q[1]).attr('r',3.5).attr('fill',o.line.color||'#fff').attr('stroke','#000').attr('stroke-width',1.5));}
  const xa=svg.append('g').attr('class','axis');IE.xTicks(L,a,b,W-m.l-m.r,o.align,o.minStep,o.steps).forEach(i=>xa.append('text').attr('x',xc(i)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(o.tickLabel?o.tickLabel(i):L[i]));
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
  {const it=(o.items||[]).filter(d=>d.v!=null&&isFinite(d.v)),ref=it.some(d=>d.ref!=null);if(!o.keep)it.sort((p,q)=>q.v-p.v);csvOf(el,[o.iname||'Name',o.vname?o.vname+(o.unit?' ('+o.unit+')':''):null].concat(ref?[o.rname||'Reference']:[]),it.map(d=>[d.full||d.name,cnum(d.v)].concat(ref?[cnum(d.ref)]:[])));}
  el.textContent='';const items=o.items.filter(d=>d.v!=null&&isFinite(d.v));if(!items.length)return empty(el,o.empty);
  if(!o.keep)items.sort((p,q)=>q.v-p.v);
  const W=el.clientWidth||500,rh=o.rh||27,CW=8.6,lw=o.lw||Math.min(220,W*(W<520?.5:.38),d3.max(items,d=>d.name.length)*CW+16),vwOf=a=>a.length?Math.min(130,d3.max(a,d=>IE.fmt(d.v,o.kind).length)*8.8+10):0,vwN=vwOf(items.filter(d=>d.v<0)),vw=Math.max(vwOf(items.filter(d=>d.v>=0)),vwN?0:24);
  const Ht=items.length*rh+8,ext=[Math.min(0,d3.min(items,d=>Math.min(d.v,d.ref==null?d.v:d.ref))),Math.max(0,d3.max(items,d=>Math.max(d.v,d.ref==null?d.v:d.ref)))];
  const neg=ext[0]<0,x=d3.scaleLinear().domain(ext).range([lw+(neg?vwN:0),W-vw]);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Ranked bars');
  svg.append('line').attr('x1',x(0)).attr('x2',x(0)).attr('y1',0).attr('y2',Ht).attr('stroke','#666');
  items.forEach((d,i)=>{const yy=i*rh+4,g=svg.append('g').style('cursor',o.onClick?'pointer':null);
    g.append('rect').attr('x',0).attr('y',yy-2).attr('width',W).attr('height',rh).attr('fill','transparent');
    let nm=d.name;const maxc=Math.floor((lw-10)/CW);if(nm.length>maxc)nm=nm.slice(0,maxc-1)+'…';
    g.append('text').attr('x',lw-8).attr('y',yy+rh/2+2).attr('text-anchor','end').attr('font-size',15).attr('font-weight',d.hl?600:400).text(nm);
    const x0=Math.min(x(0),x(d.v)),bw=Math.abs(x(d.v)-x(0));
    g.append('rect').attr('x',x0).attr('y',yy+3).attr('width',Math.max(1,bw)).attr('height',rh-10).attr('rx',3).attr('fill',d.color||o.color||IE.PAL[0]);
    if(d.ref!=null)g.append('line').attr('x1',x(d.ref)).attr('x2',x(d.ref)).attr('y1',yy).attr('y2',yy+rh-4).attr('stroke','#fff').attr('stroke-width',2.5);
    g.append('text').attr('x',d.v<0?x(d.v)-6:x(d.v)+6).attr('y',yy+rh/2+2).attr('text-anchor',d.v<0?'end':'start').attr('font-size',15).text(IE.fmt(d.v,o.kind));
    g.on('mousemove',ev=>IE.tip.show('<div class="t">'+esc(d.full||d.name)+'</div><div class="r"><span>'+esc(o.vname||'Value')+'</span><b>'+IE.fmt(d.v,o.kind)+'</b></div>'+(d.ref!=null?'<div class="r"><span>'+esc(o.rname||'Reference')+'</span><b>'+IE.fmt(d.ref,o.kind)+'</b></div>':'')+(d.extra||'')+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev)).on('mouseleave',IE.tip.hide);
    if(o.onClick)g.on('click',()=>o.onClick(d));});
};

/* ---------- dumbbell: two values per row (e.g. old survey vs new), joined by a line, with the gap at the right.
   o: {rows:[{name, sub, a, b, gap, extra}], A:{name,color} (drawn as a ring), B:{name,color} (a filled dot), fmt(v), gapFmt(v), max, unit, label} ---------- */
IE.dumbbell=function(el,o){
  const rows=o.rows.filter(r=>r.a!=null&&r.b!=null);
  csvOf(el,['Group','Detail',o.A.name,o.B.name,o.gapName||'Difference'],rows.map(r=>[r.name,r.sub||'',cnum(r.a),cnum(r.b),cnum(r.gap!=null?r.gap:r.b-r.a)]));
  el.textContent='';if(!rows.length)return empty(el,o.empty);
  const F=o.fmt||(v=>IE.fmt(v,o.kind||'pct')),G=o.gapFmt||(v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1)+' pp');
  const W=el.clientWidth||600,narrow=W<560,lw=narrow?0:Math.min(250,W*.3),gw=narrow?0:110,rh=narrow?92:70,top=8,axh=34,Ht=top+rows.length*rh+axh;
  const mx=o.max||d3.max(rows,r=>Math.max(r.a,r.b))*1.08,x=d3.scaleLinear().domain([0,mx]);if(!o.max)x.nice(4);x.range([lw+(narrow?48:70),W-gw-(narrow?48:62)]);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Dumbbell chart');
  const g=svg.append('g').attr('class','gridl');x.ticks(4).forEach(t=>g.append('line').attr('x1',x(t)).attr('x2',x(t)).attr('y1',top).attr('y2',Ht-axh+4));
  const ax=svg.append('g').attr('class','axis');x.ticks(4).forEach(t=>ax.append('text').attr('x',x(t)).attr('y',Ht-axh+26).attr('text-anchor','middle').text(IE.tickFmt(o.kind||'pct',mx,25)(t)));
  if(!narrow)svg.append('text').attr('x',W-4).attr('y',top+14).attr('text-anchor','end').attr('font-size',13).style('fill','rgba(255,255,255,.72)').text(o.gapName||'Difference');
  rows.forEach((r,i)=>{const y0=top+i*rh,cy=narrow?y0+rh-30:y0+rh/2+4,row=svg.append('g');
    row.append('rect').attr('x',0).attr('y',y0).attr('width',W).attr('height',rh).attr('fill','transparent');
    if(narrow){row.append('text').attr('x',0).attr('y',y0+24).attr('font-size',17).attr('font-weight',600).text(r.name).append('tspan').attr('font-weight',400).attr('font-size',14).style('fill','rgba(255,255,255,.72)').text(r.sub?'  '+r.sub:'');}
    else{row.append('text').attr('x',lw-4).attr('y',cy-4).attr('text-anchor','end').attr('font-size',18).attr('font-weight',600).text(r.name);
      if(r.sub)row.append('text').attr('x',lw-4).attr('y',cy+16).attr('text-anchor','end').attr('font-size',14).style('fill','rgba(255,255,255,.72)').text(r.sub);}
    const xa=x(r.a),xb=x(r.b);
    row.append('line').attr('x1',xa).attr('x2',xb).attr('y1',cy).attr('y2',cy).attr('stroke','#8a8a8a').attr('stroke-width',4).attr('stroke-linecap','round');
    /* B (the newer value) is a filled dot; A is a ring drawn on top, so both stay visible when they nearly coincide */
    const rr=narrow?8:10;row.append('circle').attr('cx',xb).attr('cy',cy).attr('r',rr).attr('fill',o.B.color).attr('stroke','#0e0e0e').attr('stroke-width',2.5);
    row.append('circle').attr('cx',xa).attr('cy',cy).attr('r',rr+1).attr('fill','none').attr('stroke',o.A.color).attr('stroke-width',3.5);
    const lo=Math.min(r.a,r.b),hi=Math.max(r.a,r.b);
    row.append('text').attr('x',x(lo)-16).attr('y',cy+6).attr('text-anchor','end').attr('font-size',narrow?15:17).text(F(lo));
    row.append('text').attr('x',x(hi)+17).attr('y',cy+6).attr('text-anchor','start').attr('font-size',narrow?15:17).text(F(hi));
    const gp=r.gap!=null?r.gap:r.b-r.a;
    /* on phones the difference sits on the name line, so the dumbbell gets the full width */
    row.append('text').attr('x',W-4).attr('y',narrow?y0+24:cy+7).attr('text-anchor','end').attr('font-size',narrow?18:21).attr('font-weight',600).text(G(gp));
    row.on('mousemove',ev=>IE.tip.show('<div class="t">'+esc(r.name)+(r.sub?' ('+esc(r.sub)+')':'')+'</div><div class="r"><span>'+IE.sw(o.A.color)+esc(o.A.name)+'</span><b>'+F(r.a)+'</b></div><div class="r"><span>'+IE.sw(o.B.color)+esc(o.B.name)+'</span><b>'+F(r.b)+'</b></div><div class="r"><span>'+esc(o.gapName||'Difference')+'</span><b>'+G(gp)+'</b></div>'+(r.extra||'')+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev)).on('mouseleave',IE.tip.hide);});
};

/* ---------- sparkline ---------- */
IE.spark=function(vals){const pts=vals.map((v,i)=>[i,v]).filter(p=>p[1]!=null);if(pts.length<2)return '';const W=180,Ht=38,x=d3.scaleLinear().domain([0,vals.length-1]).range([3,W-5]),e=d3.extent(pts,p=>p[1]),y=d3.scaleLinear().domain(e[0]===e[1]?[e[0]-1,e[1]+1]:e).range([Ht-4,4]);
  const l=d3.line().x(p=>x(p[0])).y(p=>y(p[1]))(pts),z=pts[pts.length-1];const zero=e[0]<0&&e[1]>0?'<line x1="3" x2="'+(W-5)+'" y1="'+y(0)+'" y2="'+y(0)+'" stroke="#555"/>':'';
  return '<svg viewBox="0 0 '+W+' '+Ht+'" width="'+W+'" height="'+Ht+'" style="max-width:100%;height:auto;display:block" aria-hidden="true">'+zero+'<path d="'+l+'" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="'+x(z[0])+'" cy="'+y(z[1])+'" r="3.5" fill="#fff"/></svg>';};

/* ---------- map colour classes: sequential (one hue) or diverging (cyan below zero, pink above) ---------- */
const SEQ=['#12333b','#1d5562','#2f7b8c','#4ea3b6','#7fcfe2','#c4f1fb'],DIVC=['#c4f1fb','#63b8cb','#28606c','#6e2f55','#c56a9f','#fbc4e3'];
IE.classer=function(values,div,breaks){
  const v=values.filter(x=>x!=null&&isFinite(x)).sort(d3.ascending);if(!v.length)return null;
  if(div){const ab=(div.pool||v).map(Math.abs).filter(x=>x>0).sort(d3.ascending);let b1=d3.quantile(ab,.4)||1,b2=d3.quantile(ab,.8)||2;if(b2<=b1)b2=b1*2;
    const th=[-b2,-b1,0,b1,b2];return {th,cols:DIVC,div:true,f:x=>x===0?'#5a5a5a':DIVC[d3.bisectRight(th,x)]};}
  /* fixed breaks if given; otherwise sextiles. A threshold at or below the smallest value would leave an empty bottom class, so drop it */
  const th=breaks||[1,2,3,4,5].map(k=>d3.quantile(v,k/6));const u=breaks?breaks.slice():th.filter((t,i)=>(i===0||t>th[i-1])&&t>v[0]);const cols=SEQ.slice(SEQ.length-(u.length+1));
  return {th:u,cols,f:x=>cols[d3.bisectRight(u,x)]};
};
IE.scaleLegend=function(c,kind,noData){const d=h('div',{class:'legend'});const F=v=>IE.fmt(v,kind);
  const L=c.div?['below '+F(c.th[0]),F(c.th[0])+' to '+F(c.th[1]),F(c.th[1])+' to 0','0 to '+F(c.th[3]),F(c.th[3])+' to '+F(c.th[4]),F(c.th[4])+' and above']
    :c.cols.map((col,i)=>{const lo=i?F(c.th[i-1]):null,hi=i<c.th.length?F(c.th[i]):null;return lo==null?'below '+hi:hi==null?lo+' and above':lo+' to '+hi;});
  c.cols.forEach((col,i)=>d.appendChild(h('span',{html:IE.sw(col)+esc(L[i])})));d.appendChild(h('span',{html:'<i class="sw" style="background:#161616;border:1px solid #555"></i>'+esc(noData||'no data')}));return d;};

/* ---------- scatter (bubbles sized by o.pts[].size, labelled by .label) ---------- */
IE.scatterChart=function(el,o){
  csvOf(el,['Name',o.xTitle||o.xname||'x',o.yTitle||o.yname||'y'],(o.pts||[]).filter(p=>p.x!=null&&p.y!=null&&isFinite(p.x)&&isFinite(p.y)).map(p=>[p.full||p.name||p.label||'',cnum(p.x),cnum(p.y)]));
  el.textContent='';const pts=o.pts.filter(p=>p.x!=null&&p.y!=null&&isFinite(p.x)&&isFinite(p.y));if(pts.length<2)return empty(el,o.empty);
  const W=el.clientWidth||700,Ht=o.height||Math.min(640,Math.max(380,W*.62)),m={t:20,r:26,b:56,l:70},col=o.color||IE.PAL[0];
  const pad=e=>{const d=(e[1]-e[0])||1;return [e[0]-d*.06,e[1]+d*.08];};
  const x=d3.scaleLinear().domain(pad(d3.extent(pts,p=>p.x))).range([m.l,W-m.r]),y=d3.scaleLinear().domain(pad(d3.extent(pts,p=>p.y))).range([Ht-m.b,m.t]);
  const fx=IE.tickFmt(o.xkind,Math.max(Math.abs(x.domain()[0]),Math.abs(x.domain()[1]))),fy=IE.tickFmt(o.ykind,Math.max(Math.abs(y.domain()[0]),Math.abs(y.domain()[1])));
  const yt=y.ticks(6);m.l=Math.max(56,d3.max(yt,t=>fy(t).length)*8.6+12);x.range([m.l,W-m.r]);
  const r=d3.scaleSqrt().domain([0,d3.max(pts,p=>p.size||0)||1]).range([5,W>640?30:20]);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Scatter chart');
  const gg=svg.append('g').attr('class','gridl'),ax=svg.append('g').attr('class','axis');
  yt.forEach(t=>{gg.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',y(t)).attr('y2',y(t));ax.append('text').attr('x',m.l-8).attr('y',y(t)+5).attr('text-anchor','end').text(fy(t));});
  x.ticks(W>640?7:4).forEach(t=>{gg.append('line').attr('y1',m.t).attr('y2',Ht-m.b).attr('x1',x(t)).attr('x2',x(t));ax.append('text').attr('x',x(t)).attr('y',Ht-m.b+22).attr('text-anchor','middle').text(fx(t));});
  edgeFix(ax,W);
  if(x.domain()[0]<0&&x.domain()[1]>0)svg.append('line').attr('stroke','#888').attr('x1',x(0)).attr('x2',x(0)).attr('y1',m.t).attr('y2',Ht-m.b);
  if(y.domain()[0]<0&&y.domain()[1]>0)svg.append('line').attr('stroke','#888').attr('y1',y(0)).attr('y2',y(0)).attr('x1',m.l).attr('x2',W-m.r);
  if(o.xTitle){let t=o.xTitle;const mx=Math.floor((W-20)/8);if(t.length>mx)t=t.slice(0,mx-1)+'…';svg.append('text').attr('x',(m.l+W-m.r)/2).attr('y',Ht-8).attr('text-anchor','middle').attr('font-size',15).text(t);}
  pts.sort((p,q)=>(q.size||0)-(p.size||0));
  const g=svg.append('g').selectAll('g').data(pts).join('g').style('cursor',o.onClick?'pointer':null);
  g.append('circle').attr('cx',p=>x(p.x)).attr('cy',p=>y(p.y)).attr('r',p=>r(p.size||0)).attr('fill',p=>p.color||col).attr('fill-opacity',.38).attr('stroke',p=>p.color||col).attr('stroke-width',1.5);
  g.append('text').attr('x',p=>x(p.x)).attr('y',p=>y(p.y)+5).attr('text-anchor','middle').attr('font-size',13).attr('font-weight',600).attr('paint-order','stroke').attr('stroke','#000').attr('stroke-width',3).text(p=>p.label||'');
  g.on('mousemove',(ev,p)=>IE.tip.show(o.tipHtml?o.tipHtml(p):'<div class="t">'+esc(p.name||p.label)+'</div><div class="r"><span>x</span><b>'+IE.fmt(p.x,o.xkind)+'</b></div><div class="r"><span>y</span><b>'+IE.fmt(p.y,o.ykind)+'</b></div>',ev)).on('mouseleave',IE.tip.hide);
  if(o.onClick)g.on('click',(ev,p)=>o.onClick(p));
};

/* ---------- India state map (needs topojson + window.GEO) ----------
   Values are written on each state. A state too small for its label gets a callout into empty space
   (sea or beyond the border) if one is defined below; labels that would overlap are left off, and every
   value is still in the tooltip. o.labels:false turns labels off; o.labelFmt(v) overrides the format. */
IE.fmtShort=function(v,kind){if(v==null||!isFinite(v))return '';const a=Math.abs(v),m=v<0?'−':'';
  switch(kind){case 'pct':case 'pct2':return m+(a>=100?a.toFixed(0):a>=1||a===0?a.toFixed(1):a.toFixed(2))+'%';case 'pp':return (v>0?'+':m)+a.toFixed(1);
    case 'cr':return m+(a>=1e5?(a/1e5).toFixed(a>=1e6?0:1)+'L':IE.IN(Math.round(a)));case 'rs':return m+'₹'+(a>=1e5?(a/1e5).toFixed(1)+'L':a>=1e3?Math.round(a/1e3)+'k':Math.round(a));
    case 'num':case 'pop':return m+(a>=1e7?(a/1e7).toFixed(1)+'cr':a>=1e5?(a/1e5).toFixed(1)+'L':IE.IN(Math.round(a)));default:return m+(a>=100?IE.IN(Math.round(a)):a.toFixed(1));}};
const CALLOUT={'Goa':[-.075,.012],'Kerala':[-.075,.03],'Puducherry':[.075,0],'Sikkim':[0,-.05],'Tripura':[-.045,.06],'Mizoram':[.055,.045],'Manipur':[.065,.01],
  'Nagaland':[.065,-.025],'Meghalaya':[-.035,.05],'NCT Delhi':[-.075,.012],'Andaman and Nicobar Islands':[-.06,0],'Dadra and Nagar Haveli and Daman and Diu':[-.07,-.01],'Lakshadweep':[.04,0]};
IE.mapChart=function(el,o){
  csvOf(el,['State',o.title?o.title+(o.unit?' ('+o.unit+')':''):null],Object.keys(o.values||{}).filter(k=>o.values[k]!=null&&isFinite(o.values[k])).sort().map(k=>[k,cnum(o.values[k])]));
  el.textContent='';const FEAT=topojson.feature(window.GEO,window.GEO.objects.states).features;
  const W=el.clientWidth||520,Ht=Math.min(680,W*1.08),proj=d3.geoMercator().fitExtent([[4,4],[W-4,Ht-4]],{type:'FeatureCollection',features:FEAT}),path=d3.geoPath(proj);
  const svg=d3.select(el).append('svg').attr('width',W).attr('height',Ht).attr('role','img').attr('aria-label',o.label||'Map of India by state');
  const look=f=>o.lookup?o.lookup(f.properties.n):f.properties.n;
  svg.selectAll('path').data(FEAT).join('path').attr('d',path).attr('fill',f=>{const v=o.values[look(f)];return v==null||!o.cl?'#161616':o.cl.f(v);}).attr('stroke','#000').attr('stroke-width',.8)
    .style('cursor',f=>o.onClick&&o.values[look(f)]!=null?'pointer':null)
    .on('mousemove',function(ev,f){const n=look(f),v=o.values[n];d3.select(this).attr('stroke','#fff').attr('stroke-width',1.6).raise();lab.raise();
      IE.tip.show(o.tipHtml?o.tipHtml(f.properties.n,n,v):'<div class="t">'+esc(f.properties.n)+(n!==f.properties.n?' (data for '+esc(n)+')':'')+'</div><div class="r"><span>'+esc(o.title||'')+'</span><b>'+IE.fmt(v,o.kind)+'</b></div>'+(o.unit?'<div class="m">'+esc(o.unit)+'</div>':''),ev);})
    .on('mouseleave',function(){d3.select(this).attr('stroke','#000').attr('stroke-width',.8);IE.tip.hide();})
    .on('click',(ev,f)=>{const n=look(f);if(o.onClick&&o.values[n]!=null)o.onClick(n);});
  const lab=svg.append('g').attr('pointer-events','none');
  if(o.labels===false)return;
  const fs=W<460?11:13,cw=fs*.64,lf=o.labelFmt||(v=>IE.fmtShort(v,o.kind)),placed=[];
  // a label whose value is shared with another state (e.g. Ladakh showing Jammu and Kashmir) is written once
  const seen=new Set();
  const items=FEAT.map(f=>{const n=look(f),v=o.values[n];if(v==null||!isFinite(v))return null;const c=path.centroid(f),b=path.bounds(f);
      return {f,n,v,c,b,area:path.area(f),t:lf(v)};}).filter(d=>d&&isFinite(d.c[0])).sort((p,q)=>q.area-p.area);
  const fits=(r)=>r.x0>=2&&r.x1<=W-2&&r.y0>=2&&r.y1<=Ht-2&&!placed.some(p=>!(r.x1<p.x0||r.x0>p.x1||r.y1<p.y0||r.y0>p.y1));
  const box=(x,y,t)=>{const w=t.length*cw+8,hh=fs+4;return {x0:x-w/2,x1:x+w/2,y0:y-hh/2,y1:y+hh/2};};
  const later=[];
  // a label goes where its whole box lies inside the state: the centroid if possible, else the nearest point that works
  const inside=(f,x,y)=>{const ll=proj.invert([x,y]);return ll&&d3.geoContains(f,ll);};
  const within=(f,r)=>{const ix=(r.x1-r.x0)*.18,iy=(r.y1-r.y0)*.2;return [[r.x0+ix,r.y0+iy],[r.x1-ix,r.y0+iy],[r.x0+ix,r.y1-iy],[r.x1-ix,r.y1-iy],[(r.x0+r.x1)/2,(r.y0+r.y1)/2]].every(q=>inside(f,q[0],q[1]));};  // a slight overhang at the edges is allowed
  items.forEach(d=>{if(d.n!==d.f.properties.n&&seen.has(d.n))return;
    const bw=d.b[1][0]-d.b[0][0],bh=d.b[1][1]-d.b[0][1],w0=box(0,0,d.t);
    if(bw>=(w0.x1-w0.x0)*1.05&&bh>=fs*1.4){
      let best=null,bd=1e9;const r0=box(d.c[0],d.c[1],d.t);if(within(d.f,r0)&&fits(r0))best=r0;
      else{const st=Math.max(3,fs/2);for(let x=d.b[0][0];x<=d.b[1][0];x+=st)for(let y=d.b[0][1];y<=d.b[1][1];y+=st){const dd=(x-d.c[0])**2+(y-d.c[1])**2;if(dd>=bd)continue;const r=box(x,y,d.t);if(within(d.f,r)&&fits(r)){best=r;bd=dd;}}}
      if(best){placed.push(best);seen.add(d.n);d.r=best;return;}}
    later.push(d);});
  // small states: callout into empty space, after the big ones are placed
  later.forEach(d=>{const co=CALLOUT[d.f.properties.n];if(!co||seen.has(d.n))return;const x=d.c[0]+co[0]*W,y=d.c[1]+co[1]*Ht,r=box(x,y,d.t);if(!fits(r))return;placed.push(r);seen.add(d.n);d.r=r;d.lead=true;});
  items.filter(d=>d.r).forEach(d=>{const x=(d.r.x0+d.r.x1)/2,y=(d.r.y0+d.r.y1)/2;
    if(d.lead){lab.append('line').attr('x1',d.c[0]).attr('y1',d.c[1]).attr('x2',Math.max(d.r.x0,Math.min(d.r.x1,d.c[0]))).attr('y2',d.c[1]<d.r.y0?d.r.y0:d.c[1]>d.r.y1?d.r.y1:y).attr('stroke','#fff').attr('stroke-width',1).attr('stroke-opacity',.75);
      lab.append('circle').attr('cx',d.c[0]).attr('cy',d.c[1]).attr('r',2).attr('fill','#fff');}
    // on a light fill the label is black; on a dark fill or in a callout it is white with a black halo
    const fc=d.lead||!o.cl?null:d3.rgb(o.cl.f(d.v)),lum=fc?(.2126*fc.r+.7152*fc.g+.0722*fc.b)/255:0,dark=lum>.55;
    lab.append('text').attr('x',x).attr('y',y+fs*.36).attr('text-anchor','middle').attr('font-size',fs).attr('font-weight',600).attr('font-variant-numeric','tabular-nums')
      .attr('paint-order','stroke').attr('stroke',dark?'none':'#000').attr('stroke-width',3).attr('stroke-linejoin','round').style('fill',dark?'#000':'#fff').text(d.t);});
};

/* ---------- simple view router on #hash ---------- */
IE.router=function(views,start,render,opts){IE.stopPlay();let cur=(location.hash||'').slice(1);if(!views.some(v=>v[0]===cur))cur=start;
  const api={get:()=>cur,go(v){IE.stopPlay();cur=v;try{history.replaceState(null,'','#'+v);}catch(e){location.hash=v;}render();window.scrollTo(0,0);},
    tabs(el){el.textContent='';views.forEach(([id,n])=>el.appendChild(h('a',{href:'#'+id,text:n,'aria-current':cur===id?'page':null,onclick:e=>{e.preventDefault();api.go(id);}})));}};
  window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(views.some(x=>x[0]===v)&&v!==cur){IE.stopPlay();cur=v;render();}});
  let rz,lastW=innerWidth;window.addEventListener('resize',()=>{if(innerWidth===lastW)return;lastW=innerWidth;clearTimeout(rz);rz=setTimeout(()=>{if(!IE.playing())(opts&&opts.onResize||render)();},180);});
  return api;};

IE.store={get(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
window.IE=IE;
})();
