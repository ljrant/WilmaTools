// ==UserScript==
// @name         WilmaTools - Desktop Sidebar
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.10.0
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
function sectionFor(title){
 const h=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(e=>e.textContent.trim().toLowerCase()===title.toLowerCase());
 if(!h)return null;
 let p=h.parentElement;
 while(p&&p!==document.body){
   const headings=[...p.querySelectorAll('h1,h2,h3,h4,h5,h6')];
   if(headings.length>1)break;
   if(p.querySelector('a[href]')&&p.getBoundingClientRect().width>200)return p;
   p=p.parentElement;
 }
 return h.parentElement;
}
const pathname=location.pathname;
if(['/', '/index','/dashboard','/home'].includes(pathname)){
 const homeroom=sectionFor('Ohjausryhmäsi');
 const courses=sectionFor('Ryhmät tässä jaksossa');
 // Use the real teacher-specific class link, not the invalid /students shortcut.
 const groupLink=homeroom&&[...homeroom.querySelectorAll('a[href]')].find(a=>/^\/profiles\/classes\/\d+\/?$/.test(safePath(a)||''));
 const groupPath=groupLink&&safePath(groupLink);
 const widget=document.createElement('section');widget.id='wt-home-tools';widget.style.cssText='border-top:1px solid #cbd9e5;margin-top:12px;padding:12px 0;font:14px/1.5 system-ui;color:#193c59';
 const heading=label('h3','WilmaTools — '+(lang==='fi'?'ohjausryhmän työkalut':'homeroom tools'));heading.style.margin='0 0 10px';widget.append(heading);
 const action=(text,fn)=>{const b=label('button',text);b.type='button';b.style.cssText='display:inline-block;margin:0 8px 8px 0;padding:8px 11px;border:1px solid #9fbcd1;background:#e7f1f8;color:#183f60;border-radius:7px;cursor:pointer';b.onclick=fn;widget.append(b);return b};
 if(groupPath)action(lang==='fi'?'Avaa ohjausryhmä':'Open homeroom',()=>location.assign(groupPath));
 // Gradebook route is distinct from class profile; only link if actually visited.
 const gradePath=route();
 if(gradePath)action(lang==='fi'?'Avaa arviointinäkymä':'Open grade overview',linkProgress);
 else widget.append(label('p',lang==='fi'?'Arviointinäkymän linkki tulee käyttöön, kun avaat kerran ryhmän opiskelijan suoritussivun.':'The grade overview shortcut becomes available after opening a student gradebook.'));
 if(groupPath)action(lang==='fi'?'Kopioi opiskelijoiden nimet':'Copy student names',async()=>{
  const b=event?.currentTarget;
  try{
   const response=await fetch(groupPath,{credentials:'same-origin',redirect:'follow'});
   if(!response.ok||new URL(response.url).origin!==location.origin||!/^\/profiles\/classes\/\d+\/?$/.test(new URL(response.url).pathname))throw Error('Unexpected response');
   const doc=new DOMParser().parseFromString(await response.text(),'text/html');
   // Select only explicit student profile links; deduplicate by student ID.
   const names=new Map();
   for(const a of doc.querySelectorAll('a[href]')){
    const u=new URL(a.getAttribute('href'),location.origin);
    const m=u.origin===location.origin&&u.pathname.match(/^\/profiles\/students\/(\d+)(?:\/|$)/);
    const name=a.textContent.replace(/\s+/g,' ').trim();
    if(m&&name&&name.length<120&&!names.has(m[1]))names.set(m[1],name);
   }
   if(!names.size){alert(lang==='fi'?'Opiskelijoita ei löytynyt ryhmäsivun HTML:stä. Lähetä ryhmäsivun linkkirakenne, jotta toiminto voidaan sovittaa Wilmaasi.':'No students found in the group page HTML. Additional group page structure is needed.');return}
   const output=[...names.values()].sort((a,b)=>a.localeCompare(b,'fi')).join('\n');
   try{await navigator.clipboard.writeText(output);alert((lang==='fi'?'Kopioitu nimiä: ':'Names copied: ')+names.size)}
   catch{prompt(lang==='fi'?'Kopioi nimet tästä:':'Copy names:',output)}
  }catch(e){alert((lang==='fi'?'Nimilistaa ei voitu hakea: ':'Could not retrieve class list: ')+e.message)}
 });
 else widget.append(label('p',lang==='fi'?'Ohjausryhmän linkkiä ei löydy tästä laatikosta.':'No homeroom class link found in this box.'));
 if(homeroom)homeroom.append(widget);
 // Gather CURRENT period teaching-group links already visible on home. No guessed routes.
 if(courses){
   const wrap=document.createElement('section');wrap.id='wt-course-links';wrap.style.cssText='border-top:1px solid #cbd9e5;padding-top:12px;margin-top:12px';
   wrap.append(label('h3',lang==='fi'?'WilmaTools — nykyiset opetusryhmät':'WilmaTools — current teaching groups'));
   const links=new Map();
   for(const a of courses.querySelectorAll('a[href]')){
     const path=safePath(a),name=a.textContent.replace(/\s+/g,' ').trim();
     if(path&&/^\/(?:groups|profiles\/classes)\/\d+(?:\/|$)/.test(path)&&name&&!links.has(path))links.set(path,name);
   }
   for(const [url,name]of links){
     const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:5px 0';
     row.append(label('strong',name));
     const a=label('a',lang==='fi'?'Avaa ryhmä':'Open group');a.href=url;a.style.marginRight='6px';row.append(a);
     const button=label('button',lang==='fi'?'Näytä arviointi- ja tuntimerkintälinkit':'Show grading and attendance links');button.type='button';
     button.onclick=async()=>{
       button.disabled=true;button.textContent=lang==='fi'?'Haetaan…':'Loading…';
       try{
         const response=await fetch(url,{credentials:'same-origin',redirect:'follow'});
         if(!response.ok||new URL(response.url).origin!==location.origin)throw Error('Response error');
         const doc=new DOMParser().parseFromString(await response.text(),'text/html');
         const matches=new Map();
         for(const link of doc.querySelectorAll('a[href]')){
           const text=link.textContent.replace(/\s+/g,' ').trim();
           const path=safePath(link);
           if(path&&/(arvioint|arvosan|grade|tuntimerk|poissaol|attendance|lesson\s*note)/i.test(text))matches.set(path,text);
         }
         button.textContent=lang==='fi'?'Linkit':'Links';
         if(!matches.size){row.append(label('small',lang==='fi'?'Ei tunnistettuja linkkejä ryhmäsivun HTML:ssä.':'No matching links in fetched HTML.'));return}
         const details=document.createElement('div');details.style.flexBasis='100%';
         for(const [path,text]of matches){const a=label('a',text);a.href=path;a.style.cssText='display:inline-block;margin:2px 12px 4px 0';details.append(a)}
         row.append(details);
       }catch(e){button.disabled=false;button.textContent=lang==='fi'?'Yritä uudelleen':'Retry'}
     };
     row.append(button);wrap.append(row);
   }
   if(links.size)courses.append(wrap);
 }
}
})();