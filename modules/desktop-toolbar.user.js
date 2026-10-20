// ==UserScript==
// @name         WilmaTools - Desktop Sidebar
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.17.0
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
const t={fi:{tools:'Työkalut',progress:'Ryhmänohjaajan arviointinäkymä',autosave:'Viestiluonnosten tallennus',write:'Kirjoita viesti',templates:'Viestipohjat',drafts:'Tallennetut viestit',settings:'Asetukset',language:'Kieli',close:'Sulje',open:'Avaa',install:'Asenna moduuli',hint:'Työkalut otetaan käyttöön tai pois käytöstä Tampermonkeyssa.',unknown:'Avaa ensin opiskelijan opintosuoritussivu, jotta pikavalinta voidaan tallentaa.',home:'Pikavalinta ryhmänohjaajan arviointiin',notEnabled:'Moduuli ei ole tällä sivulla käytettävissä.'},en:{tools:'Tools',progress:'Homeroom grade overview',autosave:'Message draft autosaver',write:'Compose message',templates:'Message templates',drafts:'Saved drafts',settings:'Settings',language:'Language',close:'Close',open:'Open',install:'Install module',hint:'Enable and disable modules in Tampermonkey.',unknown:'First open a student gradebook so the shortcut can be saved.',home:'Homeroom grade overview shortcut',notEnabled:'Module is not available on this page.'}};
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
function linkProgress(){if(/^\/profiles\/classes\/\d+\/?$/.test(location.pathname)){document.querySelector('#wt-class-assessment-tab a')?.click();return}location.assign('/')}

const TEMPLATE_KEY='wilmatools.messageTemplates.v1';
function templates(){try{const a=JSON.parse(localStorage.getItem(TEMPLATE_KEY)||'[]');return Array.isArray(a)?a.filter(v=>v&&typeof v.title==='string'&&typeof v.subject==='string'&&typeof v.body==='string').slice(0,50):[]}catch{return []}}
function saveTemplates(data){localStorage.setItem(TEMPLATE_KEY,JSON.stringify(data))}
function templateEditor(){
 panel.replaceChildren();
 const h=label('h2',lang==='fi'?'Viestipohjat':'Message templates');panel.append(h);
 const back=label('button',lang==='fi'?'← Työkalut':'← Tools');back.onclick=draw;panel.append(back);
 const list=document.createElement('div');panel.append(list);
 const editing=document.createElement('div');editing.style.cssText='border-top:1px solid #dce6ef;padding-top:12px;margin-top:12px';panel.append(editing);
 let edit=-1;
 function fields(){
  editing.replaceChildren();
  const data=templates(),item=data[edit]||{title:'',subject:'',body:''};
  const entries={};
  for(const [key,title,area]of [['title',lang==='fi'?'Pohjan nimi':'Template name',false],['subject',lang==='fi'?'Aihe':'Subject',false],['body',lang==='fi'?'Viesti':'Message',true]]){
   const lab=label('label',title);lab.style.cssText='display:block;font-weight:600;margin:9px 0';
   const i=document.createElement(area?'textarea':'input');if(area)i.rows=8;i.value=item[key];i.style.cssText='display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:9px;border:1px solid #a9bfd2;border-radius:6px;font:14px/1.5 system-ui';lab.append(i);editing.append(lab);entries[key]=i;
  }
  const save=label('button',lang==='fi'?'Tallenna pohja':'Save template');
  save.onclick=()=>{const v={title:entries.title.value.trim(),subject:entries.subject.value,body:entries.body.value};if(!v.title)return alert(lang==='fi'?'Anna pohjalle nimi.':'Enter a name.');const next=templates();if(edit<0)next.push(v);else next[edit]=v;saveTemplates(next);edit=-1;display()};
  editing.append(save);
  const note=label('p',lang==='fi'?'Tallentuu tämän Wilma-palvelimen selaimen localStorage-muistiin. Älä sisällytä pysyviä opiskelijatietoja pohjiin.':'Saved in localStorage on this Wilma origin. Avoid storing student information in templates.');editing.append(note);
 }
 function display(){
  list.replaceChildren();
  templates().forEach((item,index)=>{
   const row=label('div','');row.style.cssText='padding:9px 0;border-bottom:1px solid #e5edf3';
   row.append(label('strong',item.title));
   const open=label('button',lang==='fi'?'Muokkaa':'Edit');open.style.margin='5px';open.onclick=()=>{edit=index;fields()};
   const del=label('button',lang==='fi'?'Poista':'Delete');del.onclick=()=>{if(!confirm(lang==='fi'?'Poistetaanko viestipohja?':'Delete template?'))return;const data=templates();data.splice(index,1);saveTemplates(data);edit=-1;display()};
   row.append(document.createElement('br'),open,del);list.append(row);
  });
  fields();
 }
 display();
}
function draftSidebar(){
 panel.replaceChildren();panel.append(label('h2',lang==='fi'?'Viestiluonnokset':'Message drafts'));
 const back=label('button',lang==='fi'?'← Työkalut':'← Tools');back.onclick=draw;panel.append(back);
 if(!location.pathname.startsWith('/messages/compose')){
  panel.append(label('p',lang==='fi'?'Tallennustoiminnot ovat käytettävissä viestin kirjoitussivulla.':'Draft controls are available on the compose page.'));
  const open=label('button',lang==='fi'?'Avaa viestin kirjoitus':'Open compose');open.onclick=()=>location.assign('/messages/compose');panel.append(open);return;
 }
 const info=label('p',lang==='fi'?'Automaattitallennus säilyttää aiheen, tekstin ja vastaanottajatiedot paikallisesti. Tarkista vastaanottajat ennen lähetystä.':'Autosave stores subject, body and recipient information locally. Verify recipients before sending.');panel.append(info);
 const actions=[['wilma-as-save',lang==='fi'?'Tallenna nyt':'Save now'],['wilma-as-restore',lang==='fi'?'Palauta luonnos':'Restore draft'],['wilma-as-refresh-recipients',lang==='fi'?'Päivitä vastaanottajat':'Refresh recipients'],['wilma-as-clear',lang==='fi'?'Poista tallenne':'Clear saved draft']];
 for(const [id,name]of actions){const b=label('button',name);b.style.cssText='display:block;margin:9px 0';b.onclick=()=>{const original=document.getElementById(id);if(original)original.click();else alert(lang==='fi'?'Automaattitallennin ei ole käytössä. Ota se käyttöön Tampermonkeyssa.':'Autosaver is not active. Enable it in Tampermonkey.')};panel.append(b)}
 const status=label('p','');const saved=localStorage.getItem('wilma-compose-autosave:'+location.hostname+location.pathname);status.textContent=saved?(lang==='fi'?'Tallenne löytyy tästä selaimesta.':'Saved draft exists in this browser.'):(lang==='fi'?'Ei tallennetta tässä selaimessa.':'No saved draft in this browser.');panel.append(status);
}
function draw(){panel.replaceChildren();panel.append(label('h2','WilmaTools'));const close=label('button',x('close'));close.onclick=()=>{panel.hidden=true};panel.append(close);
const tools=[{name:'progress',click:()=>{linkProgress()}},{name:'autosave',click:draftSidebar},{name:'write',click:()=>location.assign('/messages/compose')}];
tools.push({name:'templates',click:templateEditor},{name:'drafts',click:draftSidebar});
for(const a of tools){const item=label('div','');item.className='item';item.append(label('strong',x(a.name)));const b=label('button',x('open'));b.onclick=a.click;item.append(b);panel.append(item)}
const setting=label('div','');setting.className='item';setting.append(label('strong',x('settings')));const select=document.createElement('select');for(const [code,name]of [['fi','Suomi'],['en','English']]){const op=label('option',name);op.value=code;select.append(op)}select.value=lang;select.onchange=()=>{lang=select.value;let s={};try{s=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}s.lang=lang;localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('wilmatools:language',{detail:lang}));draw()};setting.append(label('span',x('language')+' '),select);panel.append(setting,label('p',x('hint')));
}
btn.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)draw()};
window.addEventListener('wilmatools:open-templates',()=>{panel.hidden=false;templateEditor()});
window.addEventListener('wilmatools:open-drafts',()=>{panel.hidden=false;draftSidebar()});
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
async function openHomeroomGrades(groupUrl){location.assign(groupUrl)}
function improveHomeroomLayout(home,tools,groupUrl){
 if(home.dataset.wtLayout==='yes')return;
 const heading=[...home.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(h=>txt(h.textContent)==='Ohjausryhmäsi');
 const classLink=[...home.querySelectorAll('a[href]')].find(a=>/^\/profiles\/classes\/\d+\/?$/.test(safePath(a)||''));
 if(!heading||!classLink)return;
 const links=[...home.querySelectorAll('a[href]')].filter(a=>!a.closest('#wt-home-tools'));
 const attendance=links.find(a=>/\/attendance_edit\/?(?:\?|$)/.test(safePath(a)||'')||/^Tuntimerkinnät$/i.test(txt(a.textContent)));
 const extras=links.filter(a=>a!==attendance&&/viikoittain|viikottain|yhteenvetona/i.test(txt(a.textContent)));
 const pending=links.find(a=>/^\/profiles\/classes\/\d+\/pending\/?(?:\?|$)/.test(safePath(a)||''));
 const layout=document.createElement('div');layout.id='wt-home-layout';layout.style.cssText='display:grid!important;grid-template-columns:minmax(0,1.4fr) minmax(220px,1fr)!important;gap:10px;align-items:start;margin:5px 0;width:100%;box-sizing:border-box';
 const left=document.createElement('div');left.style.cssText='min-width:0;display:flex;flex-direction:column;gap:6px';
 const top=document.createElement('div');top.style.cssText='display:flex;flex-wrap:wrap;align-items:baseline;gap:12px';
 const classLine=classLink.closest('h6')||classLink.parentElement;
 classLink.style.cssText='font:600 18px/1.3 system-ui,sans-serif;color:#155d92;text-decoration:underline';
 const copy=tools.querySelector('button');if(copy)top.append(copy);
 left.append(top);
 const right=document.createElement('div');right.style.cssText='min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding-left:10px;border-left:1px solid #e2e8ed';
 const grade=makeAction(lang==='fi'?'▣  Arviointinäkymä':'▣  Grade overview',()=>openHomeroomGrades(groupUrl));
 grade.style.cssText='font-weight:700;font-size:16px;color:#125a90;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer';
 right.append(grade);
 if(attendance){
  const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:100%';
  attendance.style.cssText='font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:5px';
  const ico=label('span','▤');ico.setAttribute('aria-hidden','true');ico.style.cssText='font:18px/1 system-ui;color:#155d92;text-decoration:none';attendance.prepend(ico);
  line.append(attendance);
  if(pending){
    const pendingContainer=pending.parentElement;
    pending.style.cssText='display:inline-block;float:none!important;margin:0!important;font-size:12px!important;white-space:nowrap';
    line.append(pending);
    if(pendingContainer&&pendingContainer.classList.contains('pull-right')){pendingContainer.style.display='none';const emptyRow=pendingContainer.parentElement;if(emptyRow&&emptyRow.matches('.margin-bottom.clearfix')&&!emptyRow.textContent.trim())emptyRow.style.display='none';}
  }
  right.append(line);
 }
 if(extras.length){const details=document.createElement('details');details.style.cssText='font-size:12px;color:#637789';const summary=label('summary',lang==='fi'?'Muut tuntimerkintänäkymät':'Other attendance views');details.append(summary);for(const a of extras){a.style.cssText='display:inline-block;margin:5px 9px 0 0;font-size:12px';details.append(a)}right.append(details)}
 const messages=tools.querySelector('div');if(messages){messages.style.cssText='display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center';left.append(messages)}
 layout.append(left,right);
 // Remove empty wrappers from Wilma's original layout after moving their links.
 if(classLine&&classLine!==heading&&classLine.parentElement)classLine.remove();
 heading.style.cssText='display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:5px';
 heading.append(classLink);
 tools.replaceChildren(layout);
 heading.insertAdjacentElement('afterend',tools);
 // Use a predictable full-width grid regardless of Wilma's original block styles.
 tools.style.display='block';tools.style.width='100%';
 console.info('[WilmaTools] Homeroom two-column layout v0.15.0 applied');
 tools.style.cssText='border:0;margin:0;padding:0;font:15px/1.4 system-ui';
 for(const a of tools.querySelectorAll('button,a')){if(!a.classList.contains('badge')){a.style.fontSize='15px';a.style.lineHeight='1.4'}}
 const style=document.createElement('style');style.textContent='#wt-home-tools button,#wt-home-tools a:not(.badge),#wt-course-links button,#wt-course-links a{font-family:system-ui,sans-serif!important;font-size:15px!important;line-height:1.45!important}#wt-course-links{font:15px/1.45 system-ui,sans-serif!important}#wt-home-tools .badge{font-size:12px!important}@media(max-width:560px){#wt-home-layout{grid-template-columns:1fr!important}#wt-home-layout>div:nth-child(2){border-left:0!important;border-top:1px solid #e2e8ed;padding:10px 0 0!important}}';home.append(style);
 home.dataset.wtLayout='yes';
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
 if(!period)return;
 // Preserve every native Wilma course row, title, icon and link unchanged.
 // Add only an envelope icon after the existing action icons, once per group.
 const groups=new Map();
 for(const anchor of period.querySelectorAll('a[href]')){
   const href=safePath(anchor);
   if(href&&/^\/(?:groups|profiles\/classes)\/\d+\/?$/.test(href)&&!groups.has(href))groups.set(href,anchor);
 }
 for(const [groupUrl,anchor]of groups){
   let container=anchor.parentElement;
   let icons=null;
   for(let level=0;level<6&&container&&container!==period;level++,container=container.parentElement){
     const candidates=[...container.querySelectorAll('div,span,ul')].filter(el=>{
       if(el.querySelector('#wt-group-mail'))return false;
       const actions=[...el.querySelectorAll('a[href]')].filter(a=>a!==anchor&&(a.querySelector('svg,i,[class*="icon"]')||a.children.length===0&&!txt(a.textContent)));
       return actions.length>=3&&actions.length<=6&&el.querySelectorAll('a[href]').length<=8;
     });
     if(candidates.length){icons=candidates.sort((x,y)=>x.querySelectorAll('a[href]').length-y.querySelectorAll('a[href]').length)[0];break}
   }
   if(!icons||icons.querySelector('[data-wt-group-mail]'))continue;
   const mail=document.createElement('button');mail.type='button';mail.dataset.wtGroupMail='yes';
   mail.setAttribute('aria-label',lang==='fi'?'Viesti ryhmälle':'Message group');
   mail.title=lang==='fi'?'Viesti ryhmälle':'Message group';
   mail.style.cssText='display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;padding:0 3px;margin:0;border:0;background:transparent;color:#0096d6;cursor:pointer';
   mail.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
   mail.onclick=()=>groupMessage(groupUrl,'group');
   icons.append(mail);
 }

}
function swapTwoHomepageBoxes(){
 const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
 const byTitle=t=>headings.find(h=>txt(h.textContent)===t);
 const notices=byTitle('Ilmoitukset'),groups=byTitle('Ryhmät tässä jaksossa');
 if(!notices||!groups)return;
 // Only swap two boxes sharing the same immediate parent. Never move a whole column or timetable.
 function card(h){
  for(let p=h;p&&p.parentElement&&p!==document.body;p=p.parentElement){
   if(p===document.body||p.contains(notices)&&p.contains(groups))break;
   if(p.matches('.panel,.card,.well,.widget,.box,.dashboard-widget'))return p;
  }
  return null;
 }
 const a=card(notices),b=card(groups);
 if(!a||!b||a===b||a.parentElement!==b.parentElement)return;
 if(b.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING){
  // Groups currently after notices: move just the groups box before notices.
  a.before(b);
 }
}

if(['/', '/index','/dashboard','/home'].includes(location.pathname)){
 attachHome();swapTwoHomepageBoxes();
 // Wilma can render the homepage blocks after DOMContentLoaded.
 let tries=0;
 const interval=setInterval(()=>{attachHome();swapTwoHomepageBoxes();if(++tries>=12)clearInterval(interval)},1000);
}
})();