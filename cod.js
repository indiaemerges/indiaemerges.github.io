/* Renders interactive charts of the day. Each <div class="cod-int" data-spec="{...}"> holds a JSON spec;
   the static image inside (.cod-fallback) stays visible if the data or scripts fail to load. */
(function(){
"use strict";
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dLab=s=>{const [y,m,d]=s.split('-');return (+d)+' '+MON[+m-1]+' '+y;},mLab=s=>MON[+s.slice(5,7)-1]+' '+s.slice(0,4);
const COLS=['#6FD3EA','#F3E67C','#F590C6','#A99AF5','#8FE39A','#F7A873','#8E949A'];
function fmtFor(ms){return v=>{if(v==null||!isFinite(v))return 'n/a';const a=Math.abs(v);const s=ms.dec===0?IE.IN(Math.round(a)):a.toFixed(ms.dec==null?2:ms.dec);return (v<0?'−':'')+(ms.prefix||'')+s+(ms.suffix||'');};}
function tickFor(ms,max){return v=>{const a=Math.abs(v);const s=ms.dec===0?(max>=1e5?(a/1e5).toFixed(1)+'L':IE.IN(Math.round(a))):(max<5?a.toFixed(1):a.toFixed(0));return (v<0?'−':'')+(ms.prefix||'')+s;};}
async function build(box){
  const spec=JSON.parse(box.getAttribute('data-spec'));let rows;
  try{rows=await d3.csv(spec.data);}catch(e){return;}
  if(!rows||!rows.length)return;
  if(spec.type==='rank')return rank(box,spec,rows);
  if(spec.type==='line')return line(box,spec,rows);
  if(spec.type==='dumbbell')return dumb(box,spec,rows);
  if(spec.type==='map')return map(box,spec,rows);
  const L=rows.map(r=>r[spec.x]),col=c=>rows.map(r=>r[c]===''||r[c]==null?null:+r[c]);
  const st={m:0,view:'total',a:0,b:L.length-1};
  const ui=box.querySelector('.cod-ui'),plot=box.querySelector('.cod-plot'),lg=box.querySelector('.cod-legend');
  function controls(){ui.textContent='';const h=IE.h;
    if(spec.measures.length>1)ui.appendChild(h('div',{class:'ctl'},[h('span',{class:'lab',text:'Units'}),IE.seg(spec.measures.map((ms,k)=>[k,ms.label]),st.m,v=>{st.m=v;if(!spec.measures[v].stack)st.view='total';controls();draw();})]));
    if(spec.measures[st.m].stack)ui.appendChild(h('div',{class:'ctl'},[h('span',{class:'lab',text:'Show'}),IE.seg([['total','Total'],['stack',spec.stack_name||'Breakdown']],st.view,v=>{st.view=v;controls();draw();})]));
    ui.appendChild(IE.rangeCtl(L.map(dLab),st.a,st.b,(a,b)=>{st.a=a;st.b=b;draw();},'Period'));}
  function draw(){
    const ms=spec.measures[st.m],F=fmtFor(ms),sl=a=>a.slice(st.a,st.b+1),labs=sl(L);
    const ticks=labs.map((d,i)=>i).filter(i=>i===0||labs[i].slice(0,7)!==labs[i-1].slice(0,7));
    const stack=st.view==='stack'&&ms.stack?ms.stack.map((s,k)=>({name:s[1],color:COLS[k],vals:sl(col(s[0]))})):null;
    const bars=stack?null:{vals:sl(col(ms.bar)),pos:{name:spec.pos||'Positive',color:'#6FD3EA'},neg:{name:spec.neg||'Negative',color:'#F590C6'}};
    const lines=ms.line?[{name:spec.line_name||'Average',color:'#FFFFFF',vals:sl(col(ms.line)),width:2.5}]:[];
    lg.textContent='';const items=(stack?stack.map(s=>({name:s.name,color:s.color})):[{name:bars.pos.name,color:bars.pos.color},{name:bars.neg.name,color:bars.neg.color}]);
    lg.innerHTML=items.map(i=>'<span>'+IE.sw(i.color)+IE.esc(i.name)+'</span>').join('')+lines.map(l=>'<span>'+IE.sw(l.color,1)+IE.esc(l.name)+'</span>').join('');
    const ex=spec.extra||[];
    const mx=Math.max(...sl(col(ms.bar)).map(v=>Math.abs(v||0)));
    IE.comboChart(plot,{labels:labs,bars,stack,lines,fmt:F,tickFmt:tickFor(ms,mx),unit:ms.unit||ms.label,ticks,tickLabel:i=>mLab(labs[i]),tipTitle:i=>dLab(labs[i]),totalName:spec.total_name||'Total',
      extra:i=>ex.map(e=>{const v=col(e[0])[st.a+i];return v==null?'':'<div class="r"><span>'+IE.esc(e[1])+'</span><b>'+v.toFixed(e[2]==null?2:e[2])+'</b></div>';}).join(''),label:spec.title||'Chart'});
  }
  controls();draw();box.classList.add('ready');
  let t;window.addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(draw,180);});
}

/* Ranked bars: the biggest rises and falls of one measure across items, with an optional reference row in between.
   spec: {type:'rank', data, name, full?, value, kind, groups:[[label, column, value or '!value']], counts:[10,20],
          ref:{name,value}, short:{full name: short name}, up, down, extra:[[column,label,kind]], vname, unit} */
function rank(box,spec,rows){
  const ui=box.querySelector('.cod-ui'),plot=box.querySelector('.cod-plot'),lg=box.querySelector('.cod-legend'),h=IE.h;
  const groups=spec.groups||[['All',null,null]],counts=spec.counts||[10];
  const st={g:0,n:counts[0]},UP=spec.up||{name:'Prices up',color:'#F590C6'},DN=spec.down||{name:'Prices down',color:'#6FD3EA'};
  const items=rows.map(r=>({r,name:(spec.short||{})[r[spec.name]]||r[spec.name],full:r[spec.name],v:r[spec.value]===''?null:+r[spec.value]})).filter(d=>d.v!=null&&isFinite(d.v));
  function controls(){ui.textContent='';
    if(groups.length>1)ui.appendChild(h('div',{class:'ctl'},[h('span',{class:'lab',text:'Items'}),IE.seg(groups.map((g,k)=>[k,g[0]]),st.g,v=>{st.g=v;controls();draw();})]));
    if(counts.length>1)ui.appendChild(h('div',{class:'ctl'},[h('span',{class:'lab',text:'Show'}),IE.seg(counts.map(c=>[c,'Top '+c+' each way']),st.n,v=>{st.n=v;controls();draw();})]));}
  function draw(){
    const g=groups[st.g],pick=g[1]==null?items:items.filter(d=>g[2].charAt(0)==='!'?d.r[g[1]]!==g[2].slice(1):d.r[g[1]]===g[2]);
    const s=pick.slice().sort((a,b)=>b.v-a.v),n=Math.min(st.n,Math.floor(s.length/2)),top=s.slice(0,n),bot=s.slice(s.length-n);
    const ex=d=>(spec.extra||[]).map(e=>{const v=d.r[e[0]];return v===''||v==null?'':'<div class="r"><span>'+IE.esc(e[1])+'</span><b>'+(isNaN(+v)?IE.esc(v):IE.fmt(+v,e[2]||spec.kind))+'</b></div>';}).join('');
    const col=d=>Object.assign({},d,{color:d.v>0?UP.color:d.v<0?DN.color:'#8E949A',extra:ex(d)});
    const list=top.map(col);
    if(spec.ref)list.push({name:spec.ref.name,full:spec.ref.name,v:spec.ref.value,color:'#FFFFFF',hl:true});
    bot.forEach(d=>list.push(col(d)));
    lg.innerHTML=[UP,DN].map(i=>'<span>'+IE.sw(i.color)+IE.esc(i.name)+'</span>').join('')+(spec.ref?'<span>'+IE.sw('#FFFFFF')+IE.esc(spec.ref.name)+'</span>':'');
    IE.rankBars(plot,{items:list,keep:true,kind:spec.kind||'pct',vname:spec.vname||'Value',unit:spec.unit,label:spec.title||'Chart',rh:window.innerWidth<640?26:28});
  }
  controls();draw();box.classList.add('ready');
  let t,lw=window.innerWidth;window.addEventListener('resize',()=>{if(window.innerWidth===lw)return;lw=window.innerWidth;clearTimeout(t);t=setTimeout(draw,180);});
}
/* Plain line chart over months, no controls.
   spec {type:'line', data, x, series:[[column,name,color,endValue,short]], kind, unit, hlines}; the legend shows each line's latest value */
function line(box,spec,rows){
  const plot=box.querySelector('.cod-plot'),lg=box.querySelector('.cod-legend'),M=rows.map(r=>r[spec.x]),n=M.length-1,K=spec.kind||'pct';
  const S=spec.series.map((s,k)=>{const pts=rows.map((r,i)=>[i,r[s[0]]===''||r[s[0]]==null?null:+r[s[0]]]),last=pts.filter(p=>p[1]!=null).pop();
    return {name:s[1],color:s[2],endValue:!!s[3],bold:k===0,pts,last:last?last[1]:null,short:(s[4]||s[1])+(last?' '+IE.fmt(last[1],K):'')};});
  lg.innerHTML=S.map(s=>'<span>'+IE.sw(s.color,1)+IE.esc(s.name)+(s.last!=null?' <b>'+IE.fmt(s.last,K)+'</b>':'')+'</span>').join('')+((spec.hlines||[]).length&&spec.hlines_name?'<span><i class="sw ln" style="background:repeating-linear-gradient(90deg,#9a9a9a 0 5px,transparent 5px 9px)"></i>'+IE.esc(spec.hlines_name)+'</span>':'');
  const mN=i=>+M[i].slice(0,4)*12+(+M[i].slice(5,7)-1);
  function draw(){IE.lineChart(plot,{labels:M.map(m=>n>30?m.slice(0,4):MON[+m.slice(5,7)-1]),series:S,kind:K,unit:spec.unit,hlines:spec.hlines,endLabels:spec.endLabels!==false,label:spec.title||'Chart',
    align:mN,minStep:n>30?12:1,tickLabel:i=>n>30?M[i].slice(0,4):MON[+M[i].slice(5,7)-1],tipTitle:i=>MON[+M[i].slice(5,7)-1]+' '+M[i].slice(0,4),height:window.innerWidth<640?340:440});}
  draw();box.classList.add('ready');
  let t,lw=window.innerWidth;window.addEventListener('resize',()=>{if(window.innerWidth===lw)return;lw=window.innerWidth;clearTimeout(t);t=setTimeout(draw,180);});
}
/* Dumbbell, no controls: spec {type:'dumbbell', data, name, sub, a:[column,name,color], b:[column,name,color], gap, gapName, note, unit, max} */
function dumb(box,spec,rows){
  const plot=box.querySelector('.cod-plot'),lg=box.querySelector('.cod-legend'),num=v=>v===''||v==null?null:+v;
  const fmt=v=>v==null?'n/a':(spec.dec!=null?v.toFixed(spec.dec):Number.isInteger(v)?v:v.toFixed(1))+'%';
  const R=rows.map(r=>({name:r[spec.name],sub:spec.sub?r[spec.sub]:'',a:num(r[spec.a[0]]),b:num(r[spec.b[0]]),gap:spec.gap?num(r[spec.gap]):null,extra:spec.note&&r[spec.note]?'<div class="m">'+IE.esc(r[spec.note])+'</div>':''}));
  const A={name:spec.a[1],color:spec.a[2]},B={name:spec.b[1],color:spec.b[2]};
  lg.innerHTML='<span><i class="sw" style="background:none;border:3px solid '+A.color+';border-radius:50%"></i>'+IE.esc(A.name)+'</span><span><i class="sw" style="background:'+B.color+';border-radius:50%"></i>'+IE.esc(B.name)+'</span>';
  function draw(){IE.dumbbell(plot,{rows:R,A,B,fmt,gapName:spec.gapName,unit:spec.unit,max:spec.max,label:spec.title||'Chart'});}
  draw();box.classList.add('ready');
  let t,lw=window.innerWidth;window.addEventListener('resize',()=>{if(window.innerWidth===lw)return;lw=window.innerWidth;clearTimeout(t);t=setTimeout(draw,180);});
}
/* State map with a toggle between measures: spec {type:'map', data, state, measures:[{col,label,kind,unit}], tip:[[column,label,kind]]}.
   Loads topojson and the India outline only when a map chart is shown. */
const once={};function script(src){return once[src]||(once[src]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s);}));}
async function map(box,spec,rows){
  try{if(!window.topojson)await script('https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js');if(!window.GEO)await script('/assets/india-geo.js');}catch(e){return;}
  const ui=box.querySelector('.cod-ui'),plot=box.querySelector('.cod-plot'),lg=box.querySelector('.cod-legend'),h=IE.h,st={m:0};
  const byState={};rows.forEach(r=>byState[r[spec.state]]=r);
  const num=v=>v===''||v==null?null:+v;
  function controls(){ui.textContent='';if(spec.measures.length>1)ui.appendChild(h('div',{class:'ctl'},[h('span',{class:'lab',text:'Show'}),IE.seg(spec.measures.map((m,k)=>[k,m.label]),st.m,v=>{st.m=v;controls();draw();})]));}
  function draw(){const M=spec.measures[st.m],values={};rows.forEach(r=>{const v=num(r[M.col]);if(v!=null)values[r[spec.state]]=v;});
    const cl=IE.classer(Object.values(values),null,M.breaks);lg.textContent='';lg.appendChild(IE.scaleLegend(cl,M.kind));
    IE.mapChart(plot,{values,cl,kind:M.kind,title:M.label,unit:M.unit,label:(spec.title||'Map')+': '+M.label,
      tipHtml:(geo,n)=>{const r=byState[n];if(!r)return '<div class="t">'+IE.esc(geo)+'</div><div class="m">No data</div>';
        return '<div class="t">'+IE.esc(geo)+'</div>'+(spec.tip||[]).map(t=>'<div class="r"><span>'+IE.esc(t[1])+'</span><b>'+IE.fmt(num(r[t[0]]),t[2])+'</b></div>').join('')+(M.unit?'<div class="m">'+IE.esc(M.unit)+'</div>':'');}});}
  controls();draw();box.classList.add('ready');
  let t,lw=window.innerWidth;window.addEventListener('resize',()=>{if(window.innerWidth===lw)return;lw=window.innerWidth;clearTimeout(t);t=setTimeout(draw,180);});
}
function init(){if(!window.IE||!window.d3)return;if(!document.getElementById('tip'))document.body.appendChild(IE.h('div',{id:'tip',role:'status'}));document.querySelectorAll('.cod-int[data-spec]').forEach(build);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
