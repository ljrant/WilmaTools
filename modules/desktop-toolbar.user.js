// ==UserScript==
// @name         WilmaTools - Desktop Sidebar
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.13.1
// @description  Finnish-first WilmaTools sidebar on every Wilma page
// @match        https://*.inschool.fi/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
'use strict';
if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||window.__wilmaToolsHub)return;
window.__wilmaToolsHub=true;
const KEY='wilmatools.settings',lastKey='wilmatools.lastGradebook';
const t={fi:{tools:'Työkalut',progress:'Ryhmänohjaajan arviointinäkymä',autosave:'Viestiluonnosten tallennus',write:'Kirjoita viesti',settings:'Asetukset',language:'Kieli',close:'Sulje',open:'Avaa',install:'Asenna moduuli',hint:'Työkalut otetaan käyttöön tai pois käytöstä Tampermonkeyssa.',unknown:'Avaa ensin opiskelijan opintosuoritussivu, jotta pikavalinta voidaan tallentaa.',home:'Pikavalinta ryhmänohjaajan arviointiin',notEnabled:'Moduuli ei ole tällä sivulla käytettävissä.'},en:{tools:'Tools',progress:'Homeroom grade overview',autosave:'Message draft autosaver',write:'Compose message',settings:'Settings',language:'Language',close:'Close',open:'Open',install:'Install module',hint:'Enable and disable modules in Tampermonkey.',unknown:'First open a student gradebook so the shortcut can be saved.',home:'Homeroom grade overview shortcut',notEnabled:'Module is not available on this page.'}};
let lang='fi';try{lang=JSON.parse(localStorage.getItem(KEY)||'{}').lang==='en'?'en':'fi'}catch{}
const x=k=>t[lang][k],grade=/^\/profiles\/students\/\d+\/choices\/?$/;
const css=document.createElement('style');css.textContent=`
#wt-side-toggle{position:fixed;right:0;top:35%;z-index:2147483500;padding:13px 9px;border:0;border-radius:9px 0 0 9px;background:#184b75;color:white;font:600 13px system-ui;box-shadow:0 3px 12px #0003;cursor:pointer}
#wt-side-panel{position:fixed;right:0;top:0;height:100vh;width:min(350px,94vw);z-index:2147483501;background:#fff;color:#243b51;box-shadow:-7px 0 28px #0003;border-left:1px solid #b8cbd9;font:14px/1.4 system-ui;box-sizing:border-box;padding:20px;overflow-y:auto}
#wt-side-panel[hidden]{display:none!important}#wt-side-panel h2{font-size:20px;margin:0 0 22px}#wt-side-panel .item{border-top:1px solid #e3eaf0;padding:15px 0}#wt-side-panel .item strong{display:block;margin-bottom:8px}#wt-side-panel button,#wt-side-panel select,#wt-home-shortcut{padding:9px 12px;background:#e9f2f8;border:1px solid #a9bfd2;color:#153c5b;border-radius:7px;cursor:pointer;font:inherit}#wt-side-panel p{color:#596f82;font-size:12px}#wt-home-shortcut{display:inline-block;text-decoration:none;background:#155b92;color:white;font-weight:700;margin:10px 0}
`;document.head.append(css);
const btn=document.createElement('button');btn.id='wt-side-toggle';btn.textContent='WilmaTools';const panel=document.createElement('aside');panel.id='wt-side-panel';panel.hidden=true;document.body.append(btn,panel);
const label=(tag,text)=>{const a=document.createElement(tag);a.textContent=text;return a};
const savedGrade=()=>{const value=localStorage.getItem(lastKey)||'';return /^\/profiles\/students\/\d+\/choices(?:\/?|\/?\?.*)$/.test(value)?value:null};
const route=()=>grade.test(location.pathname)?location.pathname+'?view=gradebook':savedGrade();
function linkProgress(){const url=route();if(url)location.assign(url);else alert(x('unknown'))}
function draw(){panel.replaceChildren();panel.append(label('h2','WilmaTools'));const close=label('button',x('close'));close.onclick=()=>{panel.hidden=true};panel.append(close);
const tools=[{name:'progress',click:()=>{if(grade.test(location.pathname)&&document.getElementById('wt-launch'))window.dispatchEvent(new Event('wilmatools:open-progress'));else linkProgress()}},{name:'autosave',click:()=>{if(location.pathname.startsWith('/messages/compose'))window.dispatchEvent(new Event('wilmatools:open-autosaver'));else location.assign('/messages/compose')}},{name:'write',click:()=>location.assign('/messages/compose')}];
for(const a of tools){const item=label('div','');item.className='item';item.append(label('strong',x(a.name)));const b=label('button',x('open'));b.onclick=a.click;item.append(b);panel.append(item)}
const setting=label('div','');setting.className='item';setting.append(label('strong',x('settings')));const select=document.createElement('select');for(const [code,name]of [['fi','Suomi'],['en','English']]){const op=label('option',name);op.value=code;select.append(op)}select.value=lang;select.onchange=()=>{lang=select.value;let s={};try{s=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}s.lang=lang;localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('wilmatools:language',{detail:lang}));draw()};setting.append(label('span',x('language')+' '),select);panel.append(setting,label('p',x('hint')));
}
btn.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)draw()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')panel.hidden=true});


function safePath(a){try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin?u.pathname+u.search:null}catch{return null}}
function txt(s){return String(s||'').replace(/\s+/g,' ').trim()}
function makeLink(text,url){const a=label('a',text);a.href=url;a.style.cssText='display:inline-block;margin:2px 12px 3px 0;color:#125f91;text-decoration:underline';return a}
function makeAction(text,fn){const a=label('button',text);a.type='button';a.style.cssText='padding:0;margin:2px 12px 3px 0;border:0;background:transparent;color:#125f91;text-decoration:underline;font:inherit;cursor:pointer;text-align:left';a.onclick=fn;return a}
function getSection(title){
 const h=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(el=>txt(el.textContent).toLowerCase()===title.toLowerCase());if(!h)return null;
 for(let p=h.parentElement;p&&p!==document.body;p=p.parentElement){
  if(p.querySelectorAll('h1,h2,h3,h4,h5,h6').length>1)break;
  if(p.querySelector('a[href]')&&p.getBoundingClientRect().width>180)return p;
 }return h.parentElement;
}
function info(msg){alert(msg)}
async function groupDoc(url){
 const r=await fetch(url,{credentials:'same-origin',redirect:'follow',cache:'no-store'});
 const final=new URL(r.url);
 if(!r.ok||final.origin!==location.origin||!/^\/(?:groups|profiles\/classes)\/\d+(?:\/|$)/.test(final.pathname))throw Error('Ryhmäsivun haku epäonnistui');
 return new DOMParser().parseFromString(await r.text(),'text/html');
}
function studentNames(doc){
 const found=new Map();
 for(const a of doc.querySelectorAll('a[href]')){
   const href=safePath(a);const match=href&&href.match(/^\/profiles\/students\/(\d+)(?:\/|$|\?)/);
   const name=txt(a.textContent);
   if(match&&name&&name.length<120&&!found.has(match[1]))found.set(match[1],name);
 }
 return [...found.values()].sort((a,b)=>a.localeCompare(b,'fi'));
}
async function copyStudents(url){
 try{
  const names=studentNames(await groupDoc(url));
  if(!names.length)return info(lang==='fi'?'Opiskelijalinkkejä ei löydy ryhmäsivun HTML:stä.':'Student links were not found in the group page HTML.');
  const value=names.join('\n');
  try{await navigator.clipboard.writeText(value);info((lang==='fi'?'Kopioitu opiskelijaa: ':'Students copied: ')+names.length)}
  catch{prompt(lang==='fi'?'Kopioi nimilista':'Copy student names',value)}
 }catch(e){info(e.message)}
}
function groupMessageLinks(doc){
 const links={students:null,guardians:null,both:null,group:null};
 for(const a of doc.querySelectorAll('a[href]')){
  const path=safePath(a);if(!path||!path.startsWith('/messages/compose'))continue;
  const labelText=txt(a.textContent).toLowerCase();
  if(/huoltaj|guardian|parent/.test(labelText)&&/opiskelij|student/.test(labelText))links.both=path;
  else if(/huoltaj|guardian|parent/.test(labelText))links.guardians=path;
  else if(/opiskelij|student/.test(labelText))links.students=path;
  else if(/ryhm|group|viesti|message/.test(labelText))links.group=path;
 }
 return links;
}
async function groupMessage(url,type){
 try{
  const links=groupMessageLinks(await groupDoc(url));
  const target=links[type]||(type==='group'?(links.students||links.group):null);
  if(!target)return info(lang==='fi'?'Wilmasta ei löytynyt linkkiä, joka esivalitsisi tämän ryhmän vastaanottajat. Viestiä ei avattu väärillä vastaanottajilla. Tarvitsen ryhmäsivun viestilinkin HTML-rakenteen.':'No verified preselected-recipient message link was found for this group. Nothing was opened.');
  location.assign(target);
 }catch(e){info(e.message)}
}
function gradingLinks(doc){
 const found={grading:null,attendance:null};
 for(const a of doc.querySelectorAll('a[href]')){
  const path=safePath(a);if(!path)continue;
  if(/\/grading\/?(?:\?|$)/.test(path))found.grading=path;
  if(/\/attendance_edit\/?(?:\?|$)/.test(path))found.attendance=path;
 }return found;
}
function compactBlock(){const block=document.createElement('div');block.className='wt-inline-tools';block.style.cssText='margin:5px 0 4px;padding:6px 0;border-top:1px solid #dfe8ee;font:13px/1.5 system-ui';return block}
async function openHomeroomGrades(groupUrl){
 try{
  const doc=await groupDoc(groupUrl);
  let dest=null;
  for(const a of doc.querySelectorAll('a[href]')){
   const p=safePath(a);
   const m=p&&p.match(/^\/profiles\/students\/(\d+)(?:\/|$|\?)/);
   if(m){dest='/profiles/students/'+m[1]+'/choices?view=gradebook';break}
  }
  if(dest)location.assign(dest);
  else info(lang==='fi'?'Ohjausryhmän opiskelijaluettelo ei ollut saatavilla sivun HTML:ssä. Avaa ryhmä ja opiskelijan opintosuoritukset ensin.':'No student links found in the homeroom HTML. Open the group and a student gradebook first.');
 }catch(e){info(e.message)}
}
function improveHomeroomLayout(home,tools,groupUrl){
 if(home.dataset.wtLayout==='yes')return;
 const heading=[...home.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(h=>txt(h.textContent)==='Ohjausryhmäsi');
 const classLink=[...home.querySelectorAll('a[href]')].find(a=>/^\/profiles\/classes\/\d+\/?$/.test(safePath(a)||''));
 if(!heading||!classLink)return;
 const links=[...home.querySelectorAll('a[href]')].filter(a=>!a.closest('#wt-home-tools'));
 const attendance=links.find(a=>/\/attendance_edit\/?(?:\?|$)/.test(safePath(a)||'')||/^Tuntimerkinnät$/i.test(txt(a.textContent)));
 const extras=links.filter(a=>a!==attendance&&/viikoittain|viikottain|yhteenvetona/i.test(txt(a.textContent)));
 const layout=document.createElement('div');layout.id='wt-home-layout';layout.style.cssText='display:grid!important;grid-template-columns:minmax(0,1.4fr) minmax(220px,1fr)!important;gap:16px;align-items:start;margin:10px 0;width:100%;box-sizing:border-box';
 const left=document.createElement('div');left.style.cssText='min-width:0;display:flex;flex-direction:column;gap:9px';
 const top=document.createElement('div');top.style.cssText='display:flex;flex-wrap:wrap;align-items:baseline;gap:10px';
 const classLine=classLink.closest('h6')||classLink.parentElement;
 classLink.style.cssText='font-weight:700;font-size:17px';
 top.append(classLink);
 const copy=tools.querySelector('button');if(copy)top.append(copy);
 left.append(top);
 const right=document.createElement('div');right.style.cssText='min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:7px;padding-left:12px;border-left:1px solid #e2e8ed';
 const grade=makeAction(lang==='fi'?'▣  Arviointinäkymä':'▣  Grade overview',()=>openHomeroomGrades(groupUrl));
 grade.style.cssText='font-weight:700;font-size:15px;color:#125a90;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer';
 right.append(grade);
 if(attendance){attendance.style.cssText='font-weight:600;font-size:14px;display:inline-block';right.append(attendance)}
 if(extras.length){const details=document.createElement('details');details.style.cssText='font-size:12px;color:#637789';const summary=label('summary',lang==='fi'?'Muut tuntimerkintänäkymät':'Other attendance views');details.append(summary);for(const a of extras){a.style.cssText='display:inline-block;margin:5px 9px 0 0;font-size:12px';details.append(a)}right.append(details)}
 const messages=tools.querySelector('div');if(messages){messages.style.cssText='display:flex;flex-wrap:wrap;gap:2px 10px;align-items:center';left.append(messages)}
 layout.append(left,right);
 // Remove empty wrappers from Wilma's original layout after moving their links.
 if(classLine&&classLine!==heading&&classLine.parentElement)classLine.remove();
 tools.replaceChildren(layout);
 heading.insertAdjacentElement('afterend',tools);
 // Use a predictable full-width grid regardless of Wilma's original block styles.
 tools.style.display='block';tools.style.width='100%';
 console.info('[WilmaTools] Homeroom two-column layout v0.13.1 applied');
 tools.style.cssText='border:0;margin:0;padding:0;font:13px/1.5 system-ui';
 const style=document.createElement('style');style.textContent='@media(max-width:560px){#wt-home-layout{grid-template-columns:1fr!important}#wt-home-layout>div:nth-child(2){border-left:0!important;border-top:1px solid #e2e8ed;padding:10px 0 0!important}}';home.append(style);
 home.dataset.wtLayout='yes';
}
function swapDashboardSections(){
 const groups=getSection('Ryhmät tässä jaksossa'),alerts=getSection('Ilmoitukset');
 if(!groups||!alerts||groups===alerts)return;
 const hasTitle=(node,title)=>[...node.querySelectorAll('h1,h2,h3,h4,h5,h6')].some(h=>txt(h.textContent)===title);
 // Only reorder separately wrapped dashboard blocks sharing a parent.
 for(let g=groups;g&&g!==document.body;g=g.parentElement){
  if(!hasTitle(g,'Ryhmät tässä jaksossa')||hasTitle(g,'Ilmoitukset'))continue;
  for(let a=alerts;a&&a!==document.body;a=a.parentElement){
   if(!hasTitle(a,'Ilmoitukset')||hasTitle(a,'Ryhmät tässä jaksossa'))continue;
   if(a.parentElement&&a.parentElement===g.parentElement){
    if(g.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_PRECEDING)a.before(g);
    return;
   }
  }
 }
}
function attachHome(){
 const home=getSection('Ohjausryhmäsi'),period=getSection('Ryhmät tässä jaksossa');
 const classAnchor=home&&[...home.querySelectorAll('a[href]')].find(a=>/^\/profiles\/classes\/\d+\/?$/.test(safePath(a)||''));
 if(home&&classAnchor&&!home.querySelector('#wt-home-tools')){
  const url=safePath(classAnchor),tools=compactBlock();tools.id='wt-home-tools';
  // Original class title remains the navigable Wilma link.
  // Open the current teacher's actual homeroom; do not reuse an unrelated last student.
  tools.append(makeAction(lang==='fi'?'Kopioi opiskelijalista':'Copy student list',()=>copyStudents(url)));
  const messages=document.createElement('div');
  messages.append(makeAction(lang==='fi'?'Viesti opiskelijoille':'Message students',()=>groupMessage(url,'students')));
  messages.append(makeAction(lang==='fi'?'Viesti huoltajille':'Message guardians',()=>groupMessage(url,'guardians')));
  messages.append(makeAction(lang==='fi'?'Viesti opiskelijoille ja huoltajille':'Message students and guardians',()=>groupMessage(url,'both')));
  tools.append(messages);home.append(tools);
 }
 if(home&&classAnchor&&home.querySelector('#wt-home-tools')&&home.dataset.wtLayout!=='yes'){
  improveHomeroomLayout(home,home.querySelector('#wt-home-tools'),safePath(classAnchor));
 }
 if(!period||period.dataset.wtCourseLinks==='yes')return;
 const courses=new Map();
 for(const a of period.querySelectorAll('a[href]')){
  const href=safePath(a);
  if(!href||!/^\/(?:groups|profiles\/classes)\/\d+\/?$/.test(href))continue;
  const name=txt(a.textContent);if(!name||courses.has(href))continue;
  courses.set(href,{name,href,anchor:a});
 }
 if(!courses.size)return;
 period.dataset.wtCourseLinks='yes';
 const wrap=document.createElement('div');wrap.id='wt-course-links';wrap.style.cssText='border-top:1px solid #dfe8ee;padding-top:8px;margin-top:8px;font:13px/1.5 system-ui';
 for(const group of courses.values()){
  const row=document.createElement('div');row.style.cssText='padding:5px 0;border-bottom:1px solid #edf1f5';
  // Keep Wilma's existing course-name link. Only add compact actions below it.
  const title=group.anchor;
  title.style.fontWeight='600';
  const sub=document.createElement('div');sub.style.cssText='display:flex;gap:0;flex-wrap:wrap';
  sub.append(makeAction(lang==='fi'?'Viesti ryhmälle':'Message group',()=>groupMessage(group.href,'group')));
  row.append(sub);const parent=title.closest('li')||title.parentElement;
  if(parent&&parent!==period)parent.append(row);else wrap.append(row);
  // Fetch links automatically; no "show links" button.
  groupDoc(group.href).then(doc=>{
   if(!row.isConnected)return;
   const found=gradingLinks(doc);
   const frag=document.createDocumentFragment();
   if(found.grading)frag.append(makeLink(lang==='fi'?'Arviointikirja':'Gradebook',found.grading));
   if(found.attendance)frag.append(makeLink(lang==='fi'?'Tuntimerkinnät':'Attendance',found.attendance));
   sub.prepend(frag);
  }).catch(()=>{});
 }
 if(wrap.childNodes.length)period.append(wrap);
}
if(['/', '/index','/dashboard','/home'].includes(location.pathname)){
 attachHome();swapDashboardSections();
 // Wilma can render the homepage blocks after DOMContentLoaded.
 let tries=0;
 const interval=setInterval(()=>{attachHome();swapDashboardSections();if(++tries>=12)clearInterval(interval)},1000);
}
})();