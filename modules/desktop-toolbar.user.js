// ==UserScript==
// @name         WilmaTools - Desktop Toolbar
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.7.0
// @description  Finnish-first desktop tool menu in the Wilma header
// @match        https://*.inschool.fi/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
(() => {
  'use strict';
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
  if (window.__wilmaToolsHub) return;
  window.__wilmaToolsHub = true;
  const key = 'wilmatools.settings';
  const state = {open:false};
  const labels = {
    fi:{title:'WilmaTools',progress:'Ryhmänohjaajan opintoseuranta',compose:'Viestiluonnosten tallennus',settings:'Asetukset',language:'Kieli',available:'Avaa työkalu',unavailable:'Avaa ensin oikea Wilman sivu',grade:'Opiskelijan suoritussivu',message:'Viestin kirjoitus',close:'Sulje',hint:'Työkalut ovat erillisiä Tampermonkey-skriptejä. Voit ottaa ne käyttöön ja pois käytöstä Tampermonkeyssa.'},
    en:{title:'WilmaTools',progress:'Homeroom course progress',compose:'Message draft autosaver',settings:'Settings',language:'Language',available:'Open tool',unavailable:'Open the corresponding Wilma page first',grade:'Student gradebook',message:'Compose message',close:'Close',hint:'Tools are separate Tampermonkey scripts. Enable or disable each script in Tampermonkey.'}
  };
  let lang='fi';
  try {lang=JSON.parse(localStorage.getItem(key)||'{}').lang==='en'?'en':'fi';} catch {}
  const t=x=>labels[lang][x];
  function setLang(v){
    lang=v;
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
    saved.lang=v;
    localStorage.setItem(key,JSON.stringify(saved));
    draw();
    window.dispatchEvent(new CustomEvent('wilmatools:language',{detail:v}));
  }
  const css=document.createElement('style');
  css.textContent=`
  #wt-hub-anchor{display:inline-flex;align-items:center;margin:0 8px;position:relative;font:14px Arial,sans-serif;z-index:2147483600}
  #wt-hub-trigger{border:1px solid #4e7fa6!important;background:#073866!important;color:white!important;border-radius:5px!important;padding:8px 12px!important;font:600 13px Arial,sans-serif!important;cursor:pointer!important}
  #wt-hub-panel{position:absolute;top:calc(100% + 8px);right:0;width:min(330px,calc(100vw - 24px));background:white;color:#20394d;border-radius:9px;box-shadow:0 12px 32px #0004;border:1px solid #cad8e3;padding:14px;font:14px/1.4 Arial,sans-serif;white-space:normal;text-align:left}
  #wt-hub-panel[hidden]{display:none!important}
  #wt-hub-panel h3{font:700 17px Arial,sans-serif;margin:0 0 12px}
  #wt-hub-panel .wt-hub-item{padding:9px 0;border-top:1px solid #edf0f3}
  #wt-hub-panel .wt-hub-item strong{display:block;margin-bottom:5px}
  #wt-hub-panel button,#wt-hub-panel select{font:13px Arial,sans-serif;padding:6px 9px;border:1px solid #afc2d1;background:#eef4f9;border-radius:5px;color:#17374e;cursor:pointer}
  #wt-hub-panel .wt-hub-desc{font-size:12px;color:#5a6b7c;margin:5px 0 0}
  #wt-hub-panel .wt-hub-foot{margin-top:10px;font-size:11px;color:#5c6d7d}
  #wt-hub-anchor.wt-hub-fixed{position:fixed;right:9px;top:45px}
  `;
  function start(){
    if (document.getElementById('wt-hub-anchor')) return;
    (document.head||document.documentElement).append(css);
    const anchor=document.createElement('div');anchor.id='wt-hub-anchor';
    const trigger=document.createElement('button');trigger.type='button';trigger.id='wt-hub-trigger';trigger.setAttribute('aria-haspopup','true');
    const panel=document.createElement('div');panel.id='wt-hub-panel';panel.hidden=true;
    anchor.append(trigger,panel);
    // Prefer the existing Wilma top-right header, otherwise use a fixed position.
    const header=document.querySelector('header .navbar-right, .navbar .navbar-right, #topbar .navbar-right, header nav, nav.navbar');
    if(header){header.append(anchor)}else{anchor.classList.add('wt-hub-fixed');document.body.append(anchor)}
    trigger.onclick=()=>{state.open=!state.open;draw()};
    document.addEventListener('click',e=>{if(state.open&&!anchor.contains(e.target)){state.open=false;draw()}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open){state.open=false;draw()}});
    window.addEventListener('wilmatools:language',e=>{if(e.detail!==lang){lang=e.detail;draw()}});
    draw();
    function draw(){
      trigger.textContent='⚙ '+t('title');
      trigger.setAttribute('aria-expanded',String(state.open));
      panel.hidden=!state.open;
      panel.replaceChildren();
      const heading=document.createElement('h3');heading.textContent=t('title');panel.append(heading);
      const items=[
        {id:'progress',route:/^\/profiles\/students\/\d+\/choices\/?$/,event:'wilmatools:open-progress',url:'/students'},
        {id:'compose',route:/^\/messages\/compose/,event:'wilmatools:open-autosaver',url:'/messages/compose'}
      ];
      for(const item of items){
        const div=document.createElement('div');div.className='wt-hub-item';
        const title=document.createElement('strong');title.textContent=t(item.id);div.append(title);
        const b=document.createElement('button');b.type='button';b.textContent=t('available');
        const current=item.route.test(location.pathname);
        if(!current){b.disabled=true;b.title=t('unavailable')}
        b.onclick=()=>{window.dispatchEvent(new Event(item.event));state.open=false;draw()};
        div.append(b);
        if(!current){const p=document.createElement('p');p.className='wt-hub-desc';p.textContent=t(item.id==='progress'?'grade':'message')+' — '+t('unavailable');div.append(p)}
        panel.append(div);
      }
      const row=document.createElement('div');row.className='wt-hub-item';
      const label=document.createElement('label');label.textContent=t('language')+' ';
      const select=document.createElement('select');select.setAttribute('aria-label',t('language'));
      for(const [v,name] of [['fi','Suomi'],['en','English']]){const o=document.createElement('option');o.value=v;o.textContent=name;select.append(o)}
      select.value=lang;select.onchange=e=>setLang(e.target.value);label.append(select);row.append(label);panel.append(row);
      const foot=document.createElement('p');foot.className='wt-hub-foot';foot.textContent=t('hint');panel.append(foot);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
