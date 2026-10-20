// ==UserScript==
// @name         WilmaTools - Desktop Sidebar
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.9.0
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
const path=location.pathname;if(path==='/'||path==='/index'||path==='/dashboard'||path==='/home'){
 const host=document.querySelector('main, #main-content, .container, #content')||document.body;
 const box=document.createElement('div');box.style.cssText='margin:14px 0;padding:14px;border:1px solid #abc9dc;border-radius:9px;background:#eef6fb';
 const a=document.createElement('a');a.id='wt-home-shortcut';a.href=route()||'/students';a.textContent=x('home')+' →';box.append(a);
 if(!route())box.append(label('p',x('unknown')));host.prepend(box);
}
})();
