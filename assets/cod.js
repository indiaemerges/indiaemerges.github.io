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
function init(){if(!window.IE||!window.d3)return;if(!document.getElementById('tip'))document.body.appendChild(IE.h('div',{id:'tip',role:'status'}));document.querySelectorAll('.cod-int[data-spec]').forEach(build);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
