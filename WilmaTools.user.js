// ==UserScript==
// @name         WilmaTools
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.19.0
// @description  Local Wilma homeroom gradebook overview, FI/EN
// @match        https://*.inschool.fi/profiles/classes/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
'use strict';
const classRoute=location.pathname.match(/^\/profiles\/classes\/(\d+)(?:\/|$)/);
if(!classRoute||window.__wilmatools04)return;window.__wilmatools04=true;
const classBase='/profiles/classes/'+classRoute[1];
const onClassMain=location.pathname.replace(/\/$/,'')===classBase;
const T={fi:{launch:'WilmaTools',title:'WilmaTools – Ryhmänohjaajan opintoseuranta',collect:'Kerää ryhmän tiedot',stop:'Pysäytä',close:'Sulje',matrix:'Opintojaksot',issues:'Huomiot',settings:'Asetukset',language:'Kieli',enabled:'Opintoseuranta käytössä',school:'Lukuvuosi',custom:'Oma aikaväli',all:'Kaikki päivämäärät',from:'Alkaen',to:'Päättyen',search:'Hae opiskelijaa tai opintojaksoa',hide:'Piilota opintojaksoja',export:'Vie CSV',student:'Opiskelija',course:'Opintojakso',grade:'Arvosana',issue:'Huomio',critical:'Vakava',low:'Alle 7',ready:'Opiskelijalinkkejä löytyi: {n}. Varmista, että ryhmä on oikea.',confirm:'Kerätäänkö {n} opiskelijan suoritukset? Tiedot pysyvät selaimessa.',reading:'Haetaan {i}/{n}…',finished:'Valmis: {n} suoritusta, {e} varoitusta. Vertaa tuloksia Wilman laajennettuun näkymään.',none:'Ei tietoja valitulla aikavälillä.',missing:'Ei merkintää',dateNote:'Päivämäärättömät suoritukset näkyvät vain Kaikki päivämäärät -valinnalla.',warning:'Huom. Näytä kaikki saattaa lisätä rivejä JavaScriptillä. Tarkista kattavuus ennen käyttöä.',found:'{n} opiskelijaa, {c} opintojaksoa, {r} suoritusta.',hideNote:'Poista valinta piilottaaksesi opintojakson.',settingsHelp:'Asetukset tallentuvat tähän selaimeen.'},
en:{launch:'WilmaTools',title:'WilmaTools – Homeroom course progress',collect:'Collect class',stop:'Stop',close:'Close',matrix:'Course matrix',issues:'Students with issues',settings:'Settings',language:'Language',enabled:'Enable progress module',school:'School year',custom:'Custom dates',all:'All dates',from:'From',to:'To',search:'Search student or course',hide:'Hide courses',export:'Export CSV',student:'Student',course:'Course',grade:'Grade',issue:'Issue',critical:'Critical',low:'Below 7',ready:'Found {n} student links. Verify the class.',confirm:'Collect records for {n} students? Data remains in your browser.',reading:'Reading {i}/{n}…',finished:'Finished: {n} records, {e} warnings. Compare with the expanded Wilma page.',none:'No records in this period.',missing:'No record',dateNote:'Undated records appear only under All dates.',warning:'Note: Show all may dynamically load extra rows. Verify completeness before using.',found:'{n} students, {c} courses, {r} records.',hideNote:'Uncheck to hide a course.',settingsHelp:'Settings are saved in this browser.'}};
const t=(k,v={})=>(T[cfg.lang][k]||k).replace(/\{(\w+)\}/g,(_,x)=>v[x]??'');
const tidy=x=>String(x??'').replace(/\s+/g,' ').trim(),p=/^\/profiles\/students\/(\d+)\/choices\/?$/;
const sy=()=>{let d=new Date();return d.getFullYear()-(d.getMonth()<7?1:0)};
const saved=(()=>{try{return JSON.parse(localStorage.getItem('wilmatools.settings')||'{}')}catch{return {}}})();
const cfg={lang:saved.lang==='en'?'en':'fi',enabled:saved.enabled!==false,hidden:new Set(saved.hidden||[])};
const save=()=>localStorage.setItem('wilmatools.settings',JSON.stringify({lang:cfg.lang,enabled:cfg.enabled,hidden:[...cfg.hidden]}));
const state={loaded:false,source:'dropdown',messageSubject:'',messageText:'',messageStudentIds:new Set(),people:[],rows:[],errors:[],mode:'matrix',nameDescending:false,period:'school',year:sy(),from:'',to:'',term:'',sort:'',busy:false,stop:false};
const isoDate=s=>{let m=tidy(s).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);if(!m)return /^\d{4}-\d{2}-\d{2}$/.test(tidy(s))?tidy(s):'';let d=new Date(+m[3],+m[2]-1,+m[1]);return d.getDate()===+m[1]&&d.getMonth()===+m[2]-1&&d.getFullYear()===+m[3]?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):''};
const colors={'4':['#b91c1c','#fff'],'5':['#e76f51','#fff'],'6':['#f4a261','#222'],'7':['#f6d365','#222'],'8':['#aad581','#222'],'9':['#55ae78','#fff'],'10':['#167347','#fff'],'P':['#4472c4','#fff'],'U':['#8053b8','#fff'],'K':['#bb3f8d','#fff']};
const color=(g,has)=>!has?['#e5e7eb','#333']:!g?['#fff1b8','#443300']:colors[g.toUpperCase()]||['#d69cde','#222'];
const messageStrings={
fi:{heading:'Viestit huomiota vaativille opiskelijoille',select:'Valitse',subject:'Aihe',body:'Viestipohja',prepare:'Kopioi viesti ja avaa Wilman viestit',info:'Viestit valmistellaan opiskelijakohtaisesti. Valitse vastaanottaja Wilmassa ja tarkista viesti ennen lähettämistä. Viestejä ei lähetetä automaattisesti.',empty:'Valitse ensin opiskelija.',noClipboard:'Leikepöydälle kopiointi ei onnistunut. Kopioi viesti käsin.',sampleSubject:'Opintojen eteneminen',sampleBody:'Hei {etunimi},\n\nHaluaisin keskustella opintojesi etenemisestä. Otathan yhteyttä, jotta voimme sopia jatkosta.\n\nYstävällisin terveisin,\nRyhmänohjaaja',selected:'Valittuja opiskelijoita: {n}',next:'Seuraava',open:'Avaa viestit',notice:'Viestin vastaanottajaa ei aseteta automaattisesti. Valitse Wilmassa oikea henkilö.'},
en:{heading:'Messages for students needing attention',select:'Select',subject:'Subject',body:'Message template',prepare:'Copy message and open Wilma messages',info:'Prepare messages for each student. Select the recipient in Wilma and review before sending. No automatic sending.',empty:'Select a student first.',noClipboard:'Could not copy to clipboard. Copy manually.',sampleSubject:'Course progress',sampleBody:'Hello {etunimi},\n\nI would like to discuss how your studies are progressing. Please get in touch so we can agree on next steps.\n\nBest regards,\nHomeroom teacher',selected:'Selected students: {n}',next:'Next',open:'Open messages',notice:'Recipients are not filled in automatically. Choose the correct person in Wilma.'}};
const mt=k=>messageStrings[cfg.lang][k];
const flag=g=>['4','U','K'].includes(g.toUpperCase())?'critical':['5','6'].includes(g)?'low':'';
function currentStudentName(){
  // Wilma breadcrumb: ... > group > student name [dropdown]. Never read names from grade tables.
  const current=location.pathname.match(p);
  if(!current)return '';
  const selectors=['li.dropdown:has(ul a[href*="/profiles/students/"]) > a','li.dropdown:has(ul a[href*="/profiles/students/"]) > button','[aria-label="breadcrumb"] li:last-child','ol.breadcrumb li:last-child','.breadcrumb li:last-child'];
  for(const selector of selectors){
    for(const node of document.querySelectorAll(selector)){
      const copy=node.cloneNode(true);
      copy.querySelectorAll('ul,svg,.caret,[aria-hidden="true"],button').forEach(x=>x.remove());
      const name=tidy(copy.textContent).replace(/[▾▼⌄]+$/,'').trim();
      if(name && name.length<120 && !/^(Opiskelijat|Students|Valinnat|Choices|Opinnot)$/i.test(name))return name;
    }
  }
  // The dropdown's direct anchor without href contains the selected student's name in some Wilma layouts.
  const list=[...document.querySelectorAll('li')].find(li=>li.querySelectorAll('a[href*="/profiles/students/"]').length>=2);
  if(list){const label=[...list.children].find(x=>x.matches('a:not([href]),button'));
    if(label){const copy=label.cloneNode(true);copy.querySelectorAll('span[aria-hidden],svg,.caret').forEach(x=>x.remove());const name=tidy(copy.textContent);if(name&&name.length<120)return name;}
  }
  return '';
}
async function discoverHomeroom(){
 const groupUrl=location.origin+location.pathname;
 const docs=[document];
 try{
  const response=await fetch(groupUrl,{credentials:'same-origin',cache:'no-store'});
  if(response.ok&&new URL(response.url).origin===location.origin&&new URL(response.url).pathname===location.pathname)docs.push(new DOMParser().parseFromString(await response.text(),'text/html'));
 }catch{}
 for(const doc of docs){
  const students=new Map();
  for(const a of doc.querySelectorAll('a[href]')){
   try{
    const u=new URL(a.getAttribute('href'),groupUrl);
    const m=u.origin===location.origin&&u.pathname.match(/^\/profiles\/students\/(\d+)(?:\/|$)/);
    const name=tidy(a.textContent);
    if(m&&name&&name.length<120&&!students.has(m[1]))students.set(m[1],{id:m[1],name,url:location.origin+'/profiles/students/'+m[1]+'/choices?view=gradebook'});
   }catch{}
  }
  if(students.size)return {people:[...students.values()],source:'homeroom'};
 }
 return {people:[],source:'homeroom'};
}
async function getPeople(){return discoverHomeroom()}
function discover(){
const lists=[...document.querySelectorAll('li')].map(li=>[...li.querySelectorAll('a[href]')].map(a=>{
try{const u=new URL(a.getAttribute('href'),location.href),m=u.origin===location.origin&&u.pathname.match(p);
return m?{id:m[1],name:tidy(a.textContent),url:u.origin+u.pathname+'?view=gradebook'}:null}catch{return null}
}).filter(Boolean));
lists.sort((a,b)=>new Set(b.map(x=>x.id)).size-new Set(a.map(x=>x.id)).size);
const people=new Map((lists[0]||[]).map(x=>[x.id,x]));
// Wilma's dropdown may list only the *other* students.
// Include the student whose gradebook is open, even when there is no dropdown link.
const current=location.pathname.match(p);
if(current&&!people.has(current[1])){
  const dropdown=(lists[0]||[]).length;
  // Do not guess the student's name from the page or expose their numeric ID.
  people.set(current[1],{id:current[1],
    name:currentStudentName() || (cfg.lang==='fi'?'Nykyinen opiskelija':'Current student'),
    url:location.origin+location.pathname+'?view=gradebook'});
  console.info('[WilmaTools] Current student added to dropdown list; please verify identity.',{dropdownLinks:dropdown,total:people.size});
}
return [...people.values()];
}
function parse(html,s){const doc=new DOMParser().parseFromString(html,'text/html');const table=[...doc.querySelectorAll('table')].find(a=>{const h=tidy([...a.querySelectorAll('th')].map(x=>x.textContent).join(' ')).toLowerCase();return h.includes('arvosana')&&(h.includes('ects')||h.includes('laajuus'))});if(!table)throw Error('Gradebook table not found');let group='',subject='',rows=[];for(const tr of table.querySelectorAll('tr')){const level=[...tr.classList].find(x=>/^level\d+$/.test(x)),c=[...tr.children].filter(x=>x.matches('td,th'));if(!level||c.length<3)continue;const name=tidy(c[0].textContent);if(!name)continue;if(level==='level1'){group=name;subject='';continue}if(level==='level2'){subject=name;continue}if(level!=='level3')continue;rows.push({id:s.id,student:s.name,name,group,subject,key:[group,subject,name].join('\u001f'),grade:tidy(c[1].textContent),ects:tidy(c[2].textContent),date:isoDate(c[3]?.textContent),teacher:tidy(c[4]?.textContent)})}return rows}
let root=null;const $=s=>root?.querySelector(s);const el=(tag,txt='',cls='')=>{const e=document.createElement(tag);e.textContent=txt;if(cls)e.className=cls;return e};
const style=document.createElement('style');style.textContent=`#wt-launch{position:fixed;right:16px;bottom:16px;z-index:2147483600;background:#17466f;color:white;padding:11px 16px;border:0;border-radius:9px;font-weight:700;cursor:pointer}#wt-collect,#wt-stop,#wt-status,#wt-note{display:none!important}#wt-screen{position:relative;width:100%;min-height:520px;background:transparent;font:14px system-ui,Arial;color:#17212b}#wt-panel{position:relative;display:flex;flex-direction:column;overflow:hidden;min-height:520px;max-height:82vh;border:1px solid #d4e0e8;border-radius:12px;background:#fff}#wt-header,#wt-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #ddd}#wt-header{background:#eef4fa}#wt-header strong{margin-right:auto;font-size:17px}#wt-panel button,#wt-panel select,#wt-panel input{font:inherit;padding:6px;border:1px solid #b6c3d1;border-radius:5px}#wt-status,#wt-note{padding:6px 16px;color:#4d5c69;font-size:12px}#wt-content{flex:1;overflow:auto;padding:10px 16px}#wt-content table{border-collapse:separate;border-spacing:0;font-size:12px}#wt-content th,#wt-content td{border:1px solid #d7dde2;padding:6px 8px;text-align:center}#wt-content th{position:sticky;top:0;z-index:2;background:#eaf0f6}#wt-content th:first-child,#wt-content td:first-child{position:sticky;left:0;z-index:3;text-align:left;min-width:145px;background:#fff}#wt-content th:first-child{z-index:4;background:#eaf0f6}.wt-heading{width:144px;min-width:144px;max-width:144px;white-space:normal;overflow-wrap:anywhere;word-break:normal;vertical-align:bottom;line-height:1.25;height:auto;min-height:65px;cursor:pointer}.wt-grade{font-weight:bold;min-width:38px}#wt-hide-list{max-height:145px;overflow:auto;padding:10px 18px;border-bottom:1px solid #ddd}#wt-hide-list label{display:block;margin:3px 0}#wt-content .wt-issues td{text-align:left}#wt-content .wt-issues .wt-grade{text-align:center}`;document.head.append(style);
try{localStorage.setItem('wilmatools.lastGradebook',location.pathname+location.search)}catch{}
let assessmentHost=null,assessmentLoaded=false,originalContent=[],nativeContainer=null;
function tabStrip(){return document.querySelector('ul.nav.nav-tabs.nav-tabs-primary')}
function installAssessmentTab(){
 const tabs=tabStrip();
 if(!tabs||document.getElementById('wt-class-assessment-tab'))return;
 const item=document.createElement('li');item.id='wt-class-assessment-tab';
 const link=el('a',cfg.lang==='fi'?'Arviointinäkymä':'Grade overview');
 link.href=classBase+'#wt-assessment';link.style.cssText='display:block;padding:10px 14px;background:#e7f3ff;color:#155b91;font-weight:700;border:1px solid #9fc6e5;border-radius:6px 6px 0 0';
 link.addEventListener('click',e=>{if(!onClassMain)return;e.preventDefault();e.stopPropagation();activateAssessment()});
 item.append(link);
 const issuesItem=document.createElement('li');issuesItem.id='wt-class-issues-tab';
 const issuesLink=el('a',cfg.lang==='fi'?'Huomiot':'Issues');issuesLink.href=classBase+'#wt-issues';
 issuesLink.style.cssText=link.style.cssText;
 issuesLink.addEventListener('click',e=>{if(!onClassMain)return;e.preventDefault();e.stopPropagation();activateAssessment('issues')});
 issuesItem.append(issuesLink);
 const support=[...tabs.querySelectorAll('a')].find(a=>/Tuen tilastot|Support statistics/i.test(a.textContent));
 if(support){
  const dropdown=support.closest('li.dropdown');
  if(dropdown&&dropdown.parentElement===tabs)dropdown.after(item,issuesItem);else tabs.append(item,issuesItem);
 }else tabs.append(item,issuesItem);
 if(onClassMain)tabs.addEventListener('click',e=>{if(!e.target.closest('#wt-class-assessment-tab,#wt-class-issues-tab'))restoreNativeContent()},true);
}
function restoreNativeContent(){
 if(!assessmentHost)return;
 assessmentHost.hidden=true;
 for(const entry of originalContent){entry.node.style.display=entry.display}
 document.getElementById('wt-class-assessment-tab')?.classList.remove('active');
 document.getElementById('wt-class-issues-tab')?.classList.remove('active');
}
function activateAssessment(mode='matrix'){
 if(!onClassMain){location.assign(classBase+(mode==='issues'?'#wt-issues':'#wt-assessment'));return}
 state.mode=mode;
 installAssessmentTab();
 const tabs=tabStrip();if(!tabs)return;
 if(!assessmentHost){
  assessmentHost=el('section');assessmentHost.id='wt-assessment-host';
  assessmentHost.style.cssText='width:100%;min-height:460px;background:#fff;border-top:1px solid #d7e1e9;padding:0 0 16px';
  // Find Wilma's tab-content level, keeping the tab bar and its ancestors visible.
  let container=tabs.parentElement;
  for(let depth=0;depth<3&&container.parentElement;depth++){
   const other=[...container.children].filter(n=>n.nodeType===1&&!n.contains(tabs)&&n!==tabs&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE');
   if(other.length)break;
   container=container.parentElement;
  }
  nativeContainer=container;
  const barChild=[...container.children].find(n=>n===tabs||n.contains(tabs));
  if(!barChild)return;
  barChild.insertAdjacentElement('afterend',assessmentHost);
  originalContent=[...container.children].filter(n=>n!==assessmentHost&&n!==barChild&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE').map(node=>({node,display:node.style.display}));
 }
 for(const entry of originalContent)entry.node.style.display='none';
 assessmentHost.hidden=false;
 tabs.querySelectorAll('li.active').forEach(n=>n.classList.remove('active'));
 document.getElementById('wt-class-assessment-tab')?.classList.toggle('active',mode==='matrix');
 document.getElementById('wt-class-issues-tab')?.classList.toggle('active',mode==='issues');
 if(!root)open();else render();
 if(!assessmentLoaded){assessmentLoaded=true;collect()}
}
installAssessmentTab();
let tabTries=0;const tabTimer=setInterval(()=>{
 installAssessmentTab();
 if(onClassMain&&['#wt-assessment','#wt-issues'].includes(location.hash)&&document.getElementById('wt-class-assessment-tab')&&!assessmentLoaded)activateAssessment(location.hash==='#wt-issues'?'issues':'matrix');
 if(++tabTries>=12)clearInterval(tabTimer)
},700);
function status(x){if($('#wt-status'))$('#wt-status').textContent=x}
function open(){state.people=[];root=el('div');root.id='wt-screen';root.innerHTML=`<div id="wt-panel" role="region" aria-label="WilmaTools"><div id="wt-header"><strong id="wt-title"></strong></div><div id="wt-toolbar"><label><select id="wt-period"><option value="school"></option><option value="custom"></option><option value="all"></option></select></label><label id="wt-year-label"><select id="wt-year"></select></label><label id="wt-from-label" hidden><span id="wt-from-caption"></span> <input id="wt-from" type="date"></label><label id="wt-to-label" hidden><span id="wt-to-caption"></span> <input id="wt-to" type="date"></label><input id="wt-search" type="search"><button id="wt-hide"></button><button id="wt-export"></button></div><div id="wt-hide-list" hidden></div><div id="wt-status"></div><div id="wt-note"></div><div id="wt-content"></div></div>`;assessmentHost.append(root);for(let y=sy()-7;y<=sy()+2;y++){const op=el('option',y+'–'+(y+1));op.value=y;$('#wt-year').append(op)}$('#wt-year').value=state.year;$('#wt-period').value=state.period;$('#wt-search').value=state.term;$('#wt-from').value=state.from;$('#wt-to').value=state.to;$('#wt-hide').onclick=()=>{$('#wt-hide-list').hidden=!$('#wt-hide-list').hidden};$('#wt-period').onchange=e=>{state.period=e.target.value;dateUI();render()};$('#wt-year').onchange=e=>{state.year=+e.target.value;render()};$('#wt-from').onchange=e=>{state.from=e.target.value;render()};$('#wt-to').onchange=e=>{state.to=e.target.value;render()};$('#wt-search').oninput=e=>{state.term=e.target.value;render()};$('#wt-export').onclick=download;translate();status(cfg.lang==='fi'?'Valmis hakemaan ryhmän tiedot.':'Ready to load group data.');render()}
function translate(){$('#wt-title').textContent=t('title');for(const [id,key] of [['hide','hide'],['export','export']])$('#wt-'+id).textContent=t(key);for(const [i,k] of [['school','school'],['custom','custom'],['all','all']])$('#wt-period').querySelector('[value="'+i+'"]').textContent=t(k);$('#wt-search').placeholder=t('search');$('#wt-from-caption').textContent=t('from');$('#wt-to-caption').textContent=t('to');$('#wt-note').textContent=t('warning')+' '+t('dateNote');dateUI()}
function dateUI(){$('#wt-year-label').hidden=state.period!=='school';$('#wt-from-label').hidden=state.period!=='custom';$('#wt-to-label').hidden=state.period!=='custom'}
function selected(){let a=state.rows.filter(r=>!cfg.hidden.has(r.key));if(state.period==='school')a=a.filter(r=>r.date&&r.date>=state.year+'-08-01'&&r.date<=(state.year+1)+'-07-31');if(state.period==='custom')a=a.filter(r=>r.date&&state.from&&state.to&&state.from<=state.to&&r.date>=state.from&&r.date<=state.to);if(state.term.trim()){let q=state.term.toLocaleLowerCase('fi');a=a.filter(r=>[r.student,r.name,r.group,r.subject].some(x=>x.toLocaleLowerCase('fi').includes(q)))}return a}
function renderHide(){const pane=$('#wt-hide-list');pane.replaceChildren(el('div',t('hideNote')));const cs=[...new Map(state.rows.map(r=>[r.key,r.name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fi'));for(const [key,name]of cs){const l=el('label');const c=el('input');c.type='checkbox';c.checked=!cfg.hidden.has(key);c.onchange=()=>{c.checked?cfg.hidden.delete(key):cfg.hidden.add(key);save();render()};l.append(c,document.createTextNode(' '+name));l.title=key.replaceAll('\u001f',' / ');pane.append(l)}}
function openMessageEditor(available){
  if(document.getElementById('wt-message-editor'))return;
  const person=available.find(x=>state.messageStudentIds.has(x.id));
  if(!person){alert(mt('empty'));return}
  const overlay=el('div');overlay.id='wt-message-editor';
  overlay.style.cssText='position:fixed;inset:0;background:#0009;z-index:2147483630;display:grid;place-items:center;padding:15px';
  const card=el('section');card.style.cssText='width:min(650px,96vw);max-height:90vh;overflow:auto;background:white;color:#213547;padding:22px;border-radius:12px;box-shadow:0 20px 60px #0005;font:14px/1.5 system-ui';
  card.append(el('h2',cfg.lang==='fi'?'Viestipohjan muokkaus':'Message template editor'));
  card.append(el('p',person.name+' — '+(cfg.lang==='fi'?'viesti lähetetään vain Wilmassa manuaalisesti':'messages are sent manually in Wilma')));
  function field(label,value,multi){const wrapper=el('label',label);wrapper.style.cssText='display:block;margin:12px 0;font-weight:600';const input=el(multi?'textarea':'input');if(multi)input.rows=9;else input.type='text';input.value=value;input.style.cssText='display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #9cabb8;border-radius:6px;font:14px/1.5 system-ui;box-sizing:border-box';wrapper.append(input);card.append(wrapper);return input}
  const subject=field(mt('subject'),state.messageSubject||mt('sampleSubject'),false);
  const body=field(mt('body'),state.messageText||mt('sampleBody'),true);
  const hint=el('p',cfg.lang==='fi'?'Muuttujat: {etunimi} (opiskelijan etunimi). Sisältö tallennetaan vain tämän välilehden muistiin.':'Variable: {etunimi} (student first name). Text is kept in this tab only.');
  card.append(hint);
  const preview=el('pre');preview.style.cssText='white-space:pre-wrap;background:#f2f6f9;border:1px solid #d9e1e8;padding:12px;border-radius:6px;max-height:200px;overflow:auto';
  const build=()=>subject.value+'\n\n'+body.value.replaceAll('{etunimi}',person.name.split(/\s+/)[0]).replaceAll('{name}',person.name.split(/\s+/)[0]);
  const update=()=>{preview.textContent=build()};subject.oninput=update;body.oninput=update;update();
  card.append(el('h3',cfg.lang==='fi'?'Esikatselu':'Preview'),preview);
  const actions=el('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:9px;margin-top:14px';
  const keep=()=>{state.messageSubject=subject.value;state.messageText=body.value};
  const close=()=>{keep();overlay.remove()};
  const copy=el('button',cfg.lang==='fi'?'Kopioi ja avaa Wilman viestit':'Copy and open Wilma messages');
  copy.onclick=async()=>{keep();try{await navigator.clipboard.writeText(build())}catch{prompt(mt('noClipboard'),build());return}alert(mt('notice'));window.open(location.origin+'/messages/compose','_blank','noopener')};
  const cancel=el('button',cfg.lang==='fi'?'Sulje':'Close');cancel.onclick=close;
  actions.append(copy,cancel);card.append(actions);overlay.append(card);document.body.append(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
}
function render(){if(!root||state.busy||!state.loaded)return;$('#wt-export').disabled=!state.rows.length;renderHide();const box=$('#wt-content');box.replaceChildren();if(!cfg.enabled||!state.rows.length){box.append(el('p',t('none')));return}const rows=selected();if(state.mode==='issues'){const flagged=rows.filter(r=>flag(r.grade));box.append(el('p',t('found',{n:new Set(flagged.map(x=>x.id)).size,c:new Set(flagged.map(x=>x.key)).size,r:flagged.length})));const unique=[...new Map(flagged.map(r=>[r.id,{id:r.id,name:r.student}])).values()];
const msgbox=el('section');msgbox.style.cssText='max-width:760px;border:1px solid #cedde9;border-radius:9px;background:#f5f9fc;padding:12px;margin:10px 0;font:14px/1.45 system-ui';
msgbox.append(el('h3',cfg.lang==='fi'?'Viestit huomiota vaativille opiskelijoille':'Message students with concerning grades'));
const help=el('p',cfg.lang==='fi'?'Valitse opiskelijat ja tallennettu viestipohja. Vastaanottajat valitaan ja tarkistetaan Wilmassa ennen lähettämistä.':'Select students and a saved template. Recipients must be selected and verified in Wilma before sending.');msgbox.append(help);
const picks=el('div');picks.style.cssText='max-height:160px;overflow:auto;border:1px solid #d2dce5;background:#fff;border-radius:5px;padding:6px;margin-bottom:10px';
for(const person of unique){const item=el('label');item.style.cssText='display:inline-block;margin:5px 15px 5px 0';const cb=el('input');cb.type='checkbox';cb.checked=state.messageStudentIds.has(person.id);cb.onchange=()=>{if(cb.checked)state.messageStudentIds.add(person.id);else state.messageStudentIds.delete(person.id)};item.append(cb,document.createTextNode(' '+person.name));picks.append(item)}msgbox.append(picks);
const templateRow=el('div');templateRow.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center';
const templateSelect=el('select');templateSelect.style.cssText='min-width:180px;max-width:100%;padding:7px';
const options=[{title:cfg.lang==='fi'?'Oletusviesti':'Default message',subject:mt('sampleSubject'),body:mt('sampleBody')}];
try{const saved=JSON.parse(localStorage.getItem('wilmatools.messageTemplates.v1')||'[]');if(Array.isArray(saved))for(const item of saved){if(typeof item?.title==='string'&&typeof item.subject==='string'&&typeof item.body==='string')options.push(item)}}catch{}
for(const [i,opt]of options.entries()){const o=el('option',opt.title);o.value=i;templateSelect.append(o)}
templateRow.append(templateSelect);
const go=el('button',cfg.lang==='fi'?'Valmistele Wilma-viesti':'Prepare Wilma message');go.onclick=async()=>{
 const people=unique.filter(p=>state.messageStudentIds.has(p.id));if(!people.length){alert(mt('empty'));return}
 const chosen=options[+templateSelect.value]||options[0];
 const body=people.length===1?chosen.body.replaceAll('{etunimi}',people[0].name.split(/\s+/)[0]).replaceAll('{name}',people[0].name.split(/\s+/)[0]):chosen.body.replaceAll('{etunimi}',cfg.lang==='fi'?'opiskelija':'student').replaceAll('{name}',cfg.lang==='fi'?'opiskelija':'student');
 const draft=chosen.subject+'\n\n'+body;
 try{await navigator.clipboard.writeText(draft)}catch{prompt(mt('noClipboard'),draft);return}
 const list=people.map(p=>p.name).join('\n');
 alert((cfg.lang==='fi'?'Viestiteksti kopioitu. Valitse Wilmassa nämä vastaanottajat ja tarkista valinta ennen lähettämistä:\n':'Message copied. Select and verify these recipients in Wilma before sending:\n')+list);
 window.open(location.origin+'/messages/compose','_blank','noopener');
};templateRow.append(go);
const editor=el('button',cfg.lang==='fi'?'Muokkaa viestipohjia sivupaneelissa':'Manage templates in sidebar');editor.onclick=()=>window.dispatchEvent(new Event('wilmatools:open-templates'));templateRow.append(editor);
msgbox.append(templateRow);box.append(msgbox);
const table=el('table');table.className='wt-issues';const h=el('tr');for(const v of ['student','course','grade','issue'])h.append(el('th',t(v)));table.append(h);flagged.sort((a,b)=>a.student.localeCompare(b.student,'fi')||a.name.localeCompare(b.name,'fi'));for(const r of flagged){const tr=el('tr');tr.append(el('td',r.student),el('td',r.name));const g=el('td',r.grade,'wt-grade'),[bg,fg]=color(r.grade,true);g.style.background=bg;g.style.color=fg;tr.append(g,el('td',t(flag(r.grade))));table.append(tr)}box.append(table);return}
const cols=[...new Map(rows.map(r=>[r.key,r.name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fi'));const by=new Map();for(const r of rows){if(!by.has(r.id))by.set(r.id,new Map());by.get(r.id).set(r.key,r)}const people=state.people.filter(s=>by.has(s.id));people.sort((a,b)=>state.sort&&state.sort!=='student'?(by.get(a.id)?.get(state.sort)?.grade||'').localeCompare(by.get(b.id)?.get(state.sort)?.grade||'','fi',{numeric:true}):a.name.localeCompare(b.name,'fi',{numeric:true})*(state.nameDescending?-1:1));box.append(el('p',t('found',{n:people.length,c:cols.length,r:rows.length})));const table=el('table'),head=el('thead'),hr=el('tr');const studentHeading=el('th',t('student')+' ↕');studentHeading.style.cursor='pointer';studentHeading.tabIndex=0;studentHeading.title=cfg.lang==='fi'?'Järjestä opiskelijan nimen mukaan':'Sort by student name';const sortStudents=()=>{state.nameDescending=state.sort==='student'?!state.nameDescending:false;state.sort='student';render()};studentHeading.onclick=sortStudents;studentHeading.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sortStudents()}};hr.append(studentHeading);for(const [key,name]of cols){const th=el('th',name,'wt-heading');th.title=key.replaceAll('\u001f',' / ');th.tabIndex=0;th.onclick=()=>{state.sort=key;render()};th.onkeydown=e=>{if(e.key==='Enter'){state.sort=key;render()}};hr.append(th)}head.append(hr);table.append(head);const body=el('tbody');for(const s of people){const tr=el('tr');tr.append(el('td',s.name));for(const [key]of cols){const r=by.get(s.id)?.get(key),td=el('td',r?(r.grade||'…'):'—','wt-grade'),[bg,fg]=color(r?.grade||'',!!r);td.style.background=bg;td.style.color=fg;td.title=r?r.name+' | ECTS: '+r.ects:t('missing');tr.append(td)}body.append(tr)}table.append(body);box.append(table)}
async function collect(){
 if(state.busy||state.loaded)return;
 state.busy=true;state.stop=false;state.errors=[];
 const lookup=await getPeople();
 if(!root){state.busy=false;return}
 state.people=lookup.people;state.source=lookup.source;
 const count=state.people.length;
 const results=Array.from({length:count},()=>[]);
 let next=0;
 const worker=async()=>{
  while(!state.stop&&root){
   const i=next++;
   if(i>=count)break;
   const student=state.people[i];
   try{
    const res=await fetch(student.url,{credentials:'same-origin',redirect:'follow',cache:'no-store'});
    const finalUrl=new URL(res.url);
    if(!res.ok||finalUrl.origin!==location.origin||!p.test(finalUrl.pathname))throw Error('Unexpected HTTP response');
    const rows=parse(await res.text(),student);
    results[i]=rows;
    if(!rows.length)state.errors.push('Student '+(i+1)+': 0 courses');
   }catch(e){
    state.errors.push('Student '+(i+1)+': '+e.message);
   }
  }
 };
 await Promise.all(Array.from({length:Math.min(5,count)},()=>worker()));
 state.rows=results.flat();
 state.busy=false;state.loaded=true;
 if(state.errors.length)console.warn('[WilmaTools] Some gradebook data was unavailable; results may be incomplete.',{unavailable:state.errors.length,total:count});
 if(root)render();
}
function download(){const header=['Student','Course','Category','Subject','Grade','ECTS','Completion date','Teacher'];const cells=[header,...selected().map(r=>[r.student,r.name,r.group,r.subject,r.grade,r.ects,r.date,r.teacher])];const quote=v=>{let s=String(v??'');if(/^\s*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};const csv='\ufeff'+cells.map(x=>x.map(quote).join(';')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=u;a.download='wilmatools_progress.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}
})();
