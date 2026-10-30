// ==UserScript==
// @name         Wilma Seating Plans — standalone beta
// @namespace    arviointiapina.seating
// @version      1.4.1
// @description  Pöytäjärjestykset, oppilasjärjestykset, arvonta ja ryhmät. Wilman tallennus pysyy erillisenä.
// @match        https://espoo.inschool.fi/groups/*/seating*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @noframes
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';
  if(window.top!==window.self)return;
  if (!/^\/groups\/\d+\/seating\/?$/.test(location.pathname)) return;
  const KEY = 'wilma-seating-plans:v1';
  const group = location.pathname.split('/')[2];
  const clone = x => JSON.parse(JSON.stringify(x));
  const coord = s => `${s.row}:${s.col}`;
  const ordered = a => [...a].sort((a,b) => a.row-b.row || a.col-b.col);
  const fresh = () => ({ version: 1, layouts: [], arrangements: [] });
  const validName = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 100;
  const validSeat = s => s && Number.isInteger(s.row) && Number.isInteger(s.col) && s.row >= 0 && s.col >= 0 && s.row < 200 && s.col < 200;
  function validate(db) {
    if (!db || db.version !== 1 || !Array.isArray(db.layouts) || !Array.isArray(db.arrangements)) throw Error('Tuntematon tiedostomuoto.');
    if (db.layouts.length + db.arrangements.length > 1000) throw Error('Liian monta tallennetta.');
    for (const [kind, items] of [['layouts', db.layouts], ['arrangements', db.arrangements]]) {
      const ids = new Set();
      for (const item of items) {
        if (!validName(item.name) || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(item.id) || ids.has(item.id)) throw Error('Virheellinen nimi tai tunniste.');
        ids.add(item.id);
        if (item.grid && (!Number.isInteger(item.grid.rows) || !Number.isInteger(item.grid.cols) || item.grid.rows<1 || item.grid.cols<1 || item.grid.rows>200 || item.grid.cols>200)) throw Error('Virheellinen ruudukon koko.');
        const seats = kind === 'layouts' ? item.seats : item.assignments;
        if (!Array.isArray(seats) || !seats.length || seats.length > 10000 || !seats.every(validSeat) || new Set(seats.map(coord)).size !== seats.length) throw Error('Virheelliset tai päällekkäiset paikat.');
        if(seats.some(s=>(s.label!==undefined&&!validName(s.label)) || (s.emptyLocked!==undefined&&typeof s.emptyLocked!=='boolean') || (s.autoEmptyLocked!==undefined&&typeof s.autoEmptyLocked!=='boolean') || (s.overflowUnlocked!==undefined&&typeof s.overflowUnlocked!=='boolean') || (s.group!==undefined&&(!Number.isInteger(s.group)||s.group<1||s.group>999))))throw Error('Virheellinen pöydän nimi, lukitus tai ryhmänumero.');
        const stations=item.stations || [];
        if(!Array.isArray(stations) || stations.length>10000 || !stations.every(st=>validSeat(st)&&validName(st.name)) || new Set(stations.map(coord)).size!==stations.length || stations.some(st=>seats.some(seat=>coord(seat)===coord(st))))throw Error('Virheelliset tai päällekkäiset työpisteet.');
        if(item.grid && stations.some(st=>st.row>=item.grid.rows||st.col>=item.grid.cols))throw Error('Työpiste on ruudukon ulkopuolella.');
        if (item.grid && seats.some(s => s.row>=item.grid.rows || s.col>=item.grid.cols)) throw Error('Paikka on tallennetun ruudukon ulkopuolella.');
        if (kind === 'arrangements') {
          if (typeof item.group !== 'string' || !/^\d+$/.test(item.group) || !seats.every(s => typeof s.student === 'string' && /^\d+$/.test(s.student)) || new Set(seats.map(s => s.student)).size !== seats.length) throw Error('Virheellinen oppilasjärjestys.');
        }
      }
    }
    return db;
  }
  const PRESETS = [
    ['single','Yksittäiset pöydät'],
    ['rows-center','Rivit · keski- ja sivukäytävät'],
    ['rows-side','Rivit · sivukäytävät'],
    ['pairs','Paripöydät'],
    ['groups4','Neljän hengen pöytäryhmät'],
    ['groups6','Kuuden hengen pöytäryhmät']
  ];
  function makePreset(key,count) {
    const definition=PRESETS.find(p=>p[0]===key);
    if(!definition || !Number.isInteger(count) || count<1 || count>10000)throw Error('Virheellinen pöytäjärjestyspohja tai paikkamäärä.');
    let columns=Math.max(key.startsWith('rows')?8:6,Math.ceil(count/100));
    if(columns%2)columns++;
    columns=Math.min(columns,Math.max(2,count));
    const seats=[];
    for(let i=0;i<count;i++) {
      const r=Math.floor(i/columns),c=i%columns;
      let row=1+r*2,col;
      if(key==='single')col=1+c*2;
      else if(key==='rows-center')col=1+c+(c>=Math.ceil(columns/2)?1:0);
      else if(key==='rows-side')col=1+c;
      else if(key==='pairs')col=1+Math.floor(c/2)*3+c%2;
      else {
        const height=key==='groups4'?2:3,size=height*2;
        const block=Math.floor(i/size),within=i%size;
        const perRow=Math.max(1,Math.floor(columns/2));
        row=1+Math.floor(block/perRow)*(height+1)+Math.floor(within/2);
        col=1+(block%perRow)*3+within%2;
      }
      seats.push({row,col});
    }
    const rows=Math.min(200,Math.max(...seats.map(s=>s.row))+2);
    const cols=Math.min(200,Math.max(...seats.map(s=>s.col))+2);
    if(seats.some(s=>s.row>=200||s.col>=200))throw Error('Paikkamäärä on liian suuri tälle pohjalle.');
    return {id:`builtin-${key}`,name:definition[1],seats,grid:{rows,cols},builtin:true};
  }
  function makeEditorLayout(config) {
    const {groups,across,rows,cols}=config;
    const total=config.total===undefined?groups*rows*cols:config.total;
    if(![groups,across,rows,cols,total].every(n=>Number.isInteger(n)&&n>=1)||groups>999||across>999||rows>100||cols>100||total>10000)throw Error('Anna positiiviset kokonaisluvut. Pohjaan mahtuu enintään 10 000 paikkaa ja 999 pöytäryhmää.');
    if(total<groups)throw Error('Paikkoja tarvitaan vähintään yksi jokaiseen pöytäryhmään. Vähennä ryhmiä tai lisää paikkoja.');
    const seats=[],width=Math.min(groups,across),height=Math.max(rows,Math.ceil(Math.ceil(total/groups)/cols));
    for(let g=0;g<groups;g++){
      const count=Math.floor(total/groups)+(g<total%groups?1:0);
      for(let i=0;i<count;i++)seats.push({row:1+Math.floor(g/width)*(height+1)+Math.floor(i/cols),col:1+(g%width)*(cols+1)+i%cols,group:g+1});
    }
    const grid={rows:Math.max(...seats.map(s=>s.row))+2,cols:Math.max(...seats.map(s=>s.col))+2};
    if(grid.rows>200||grid.cols>200)throw Error('Ruudukko kasvaa yli 200 rivin tai sarakkeen. Pienennä arvoja tai muuta ryhmien sijoittelua.');
    return {id:'editor',name:`${groups} pöytäryhmää · ${total} paikkaa`,seats,grid};
  }
  function clearAutomaticLocks(items) {
    return items.map(value=>{
      const seat={...value};
      if(seat.autoEmptyLocked)delete seat.emptyLocked;
      delete seat.autoEmptyLocked;delete seat.overflowUnlocked;
      return seat;
    });
  }
  function layoutSeats(entry) {
    const result=clearAutomaticLocks(entry.seats);
    for(const station of entry.stations||[])result.push({row:station.row,col:station.col,label:station.name,emptyLocked:true});
    return result;
  }
  function completeLayout(entry,minimum) {
    const seats=layoutSeats(entry),columns=[...new Set(seats.filter(s=>!s.emptyLocked).map(s=>s.col))].sort((a,b)=>a-b);
    if(!columns.length)columns.push(...[...new Set(seats.map(s=>s.col))].sort((a,b)=>a-b));
    if(!columns.length)columns.push(1,2,3,4,5,6);
    let missing=Math.max(0,minimum-seats.filter(s=>!s.emptyLocked).length),row=Math.max(0,...seats.map(s=>s.row))+2;
    const originalLength=seats.length;
    let nextGroup=Math.max(seats.length,...seats.map(s=>s.group||0))+1;
    while(missing>0){
      if(row>198||seats.length>=10000)throw Error('Lisäpaikat eivät mahdu ruudukkoon. Valitse leveämpi pohja tai vähennä käytävärivejä.');
      let previous=null,number=nextGroup++;
      for(const col of columns){
        if(!missing)break;
        if(seats.length>=10000)throw Error('Pohjan tekninen enimmäiskoko on 10 000 paikkaa.');
        if(previous!==null&&col>previous+1)number=nextGroup++;
        seats.push({row,col,...(number<=999?{group:number}:{})});missing--;previous=col;
      }
      row+=2;
    }
    const grid={rows:Math.max(entry.grid?.rows||1,...seats.map(s=>s.row+1),seats.length>originalLength?row:1),cols:Math.max(entry.grid?.cols||1,...seats.map(s=>s.col+1))};
    if(grid.rows>200||grid.cols>200)throw Error('Pohja ylittää ruudukon enimmäiskoon.');
    return {...entry,seats,stations:[],grid};
  }
  const FILL_DIRECTIONS=[
    ['top-left','Ylhäältä alas · vasemmalta'],
    ['top-right','Ylhäältä alas · oikealta'],
    ['bottom-left','Alhaalta ylös · vasemmalta'],
    ['bottom-right','Alhaalta ylös · oikealta'],
    ['left-top','Vasemmalta oikealle · ylhäältä'],
    ['left-bottom','Vasemmalta oikealle · alhaalta'],
    ['right-top','Oikealta vasemmalle · ylhäältä'],
    ['right-bottom','Oikealta vasemmalle · alhaalta'],
    ['snake-top','Siksak · ylhäältä alas'],
    ['snake-bottom','Siksak · alhaalta ylös']
  ];
  function orderFillSeats(items,direction) {
    const result=[...items];
    if(direction==='snake-top'||direction==='snake-bottom'){
      const rows=[...new Set(result.map(s=>s.row))].sort((a,b)=>direction==='snake-bottom'?b-a:a-b);
      const rank=new Map(rows.map((row,index)=>[row,index]));
      return result.sort((a,b)=>rank.get(a.row)-rank.get(b.row)||(rank.get(a.row)%2?b.col-a.col:a.col-b.col));
    }
    const compare={
      'top-left':(a,b)=>a.row-b.row||a.col-b.col,
      'top-right':(a,b)=>a.row-b.row||b.col-a.col,
      'bottom-left':(a,b)=>b.row-a.row||a.col-b.col,
      'bottom-right':(a,b)=>b.row-a.row||b.col-a.col,
      'left-top':(a,b)=>a.col-b.col||a.row-b.row,
      'left-bottom':(a,b)=>a.col-b.col||b.row-a.row,
      'right-top':(a,b)=>b.col-a.col||a.row-b.row,
      'right-bottom':(a,b)=>b.col-a.col||b.row-a.row
    }[direction];
    if(!compare)throw Error('Tuntematon täyttösuunta.');return result.sort(compare);
  }
  function cleanGroupLabel(value) {
    if(typeof value!=='string')return '';
    const name=value.replace(/\s*[([]?\s*\d+\s+(?:opiskelijaa?|oppilasta|students?|elever|studerande)\s*[)\]]?\s*/gi,' ').replace(/\s+/g,' ').trim().replace(/^[\s|·,:;–—-]+|[\s|·,:;–—-]+$/g,'');
    if(name.split(/\s*\/\s*/).every(part=>/^opetusryhmä$/i.test(part)))return '';
    if(!name||/^(?:ryhmä|opetusryhmä|opetusryhmät|ryhmät|istumajärjestys|poissaolot|tuntipäiväkirja|arviointi|wilma|oppilaat|opiskelijat|tiedot|näytä|tuen merkinnät|oppimisen tuki|tuki|tuntimerkinnät|kokeet|kotitehtävät|viestit)$/i.test(name))return '';
    return name.slice(0,100);
  }
  function cleanTags(value) {
    const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
    for(const [key,item] of Object.entries(value))if(/^\d+$/.test(key)&&item&&typeof item==='object')result[key]={teachingGroup:cleanGroupLabel(item.teachingGroup).slice(0,60),note:typeof item.note==='string'?item.note.slice(0,100):'',hidden:item.hidden===true};
    return result;
  }
  let db;
  try { db = validate(JSON.parse(GM_getValue(KEY, JSON.stringify(fresh())))); }
  catch { alert('Istumajärjestysten tallennetta ei voida lukea. Käynnistys keskeytettiin, jotta tietoja ei korvata.'); return; }
  const saveDB = next => { validate(next); GM_setValue(KEY, JSON.stringify(next)); db = next; };
  const id = () => crypto.randomUUID();
  let tries = 0;
  const timer = setInterval(() => {
    if (document.getElementById('wsp-panel')) { clearInterval(timer); return; }
    const main = document.querySelector('main');
    const table = main && [...main.querySelectorAll('table')].sort((a,b) => b.querySelectorAll('.ui-draggable[id]').length-a.querySelectorAll('.ui-draggable[id]').length)[0];
    if (table?.querySelector('.ui-draggable[id]')) {
      try { start(main,table); clearInterval(timer); }
      catch(e) { clearInterval(timer); alert(`Istumajärjestystyökalu: ${e.message}`); }
    } else if (++tries > 40) clearInterval(timer);
  }, 250);

  function start(main,table) {
    let cards=[...table.querySelectorAll('.ui-draggable[id]')];
    const nativeCards=[...cards];
    const getStudent=card=>card.id.match(/\d+/)?.[0];
    let byId=new Map(cards.map(card=>[getStudent(card),card]));
    const nativeById=new Map(byId);
    if(byId.size!==cards.length||byId.has(undefined))throw Error('Oppilastunnisteita ei voitu varmistaa.');
    const position=card=>{
      const cell=card.closest('td,th');
      if(!cell||cell.closest('table')!==table)throw Error('Oppilaskortti on ruudukon ulkopuolella.');
      return {row:cell.parentElement.rowIndex,col:cell.cellIndex,student:getStudent(card)};
    };
    const snapshot=()=>ordered(cards.map(position));
    const initial=snapshot();
    const sources=new Map();
    const nativeRecords=nativeCards.map(card=>({student:getStudent(card),name:card.querySelector('p')?.textContent?.trim()||'Oppilas',image:card.querySelector('img')?.getAttribute('src')||'',...position(card)}));
    sources.set(group,{id:group,label:groupName(document,group),students:nativeRecords});
    let hiddenSources=new Set(),sharedId=null,restoringShared=false;
    try{const hidden=JSON.parse(GM_getValue(`${KEY}:hiddenSources:${group}`,'[]'));if(Array.isArray(hidden))hiddenSources=new Set(hidden.filter(id=>typeof id==='string'));}catch{}
    const groupCatalog=new Map();
    let activeIds=new Set(nativeById.keys()),saving=false;
    const isCombined=()=>sources.size>1||activeIds.size!==nativeById.size||[...activeIds].some(id=>!nativeById.has(id));
    const sourceNames=student=>[...sources.values()].filter(source=>source.students.some(s=>s.student===student)).map(source=>cleanGroupLabel(source.label)||'Opetusryhmä').join(' / ');

    const fields=[...main.querySelectorAll('input[type="hidden"]')].filter(field=>{
      if(!/^\d+,\d+,\d+(?:;\d+,\d+,\d+)*;?$/.test(field.value.trim()))return false;
      const records=field.value.trim().replace(/;$/,'').split(';').map(s=>s.split(','));
      return records.length===cards.length&&new Set(records.map(r=>r[0])).size===cards.length&&initial.every(s=>records.some(r=>r[0]===s.student&&+r[1]===s.col+1&&+r[2]===s.row+1));
    });
    if(fields.length!==1)throw Error('Wilman tallennuskenttää ei voitu varmistaa.');
    const field=fields[0];
    const label=[...main.querySelectorAll('label')].find(el=>el.textContent.trim().toLowerCase()==='järjestys');
    const orderMenu=label&&(label.control||label.parentElement.querySelector('select'));
    const WORKING_KEY=`${KEY}:working:${group}`;
    const locks=new Set();
    let seats=initial.map(({row,col})=>({row,col}));
    let photosHidden=Boolean(GM_getValue(KEY+':photosHidden',false));
    let drawMode=GM_getValue(KEY+':drawMode','empty-first');
    if(!['empty-first','all','current'].includes(drawMode))drawMode='empty-first';
    let fillEnabled=Boolean(GM_getValue(KEY+':fillEnabled',false));
    let fillDirection=GM_getValue(KEY+':fillDirection','top-left');
    if(!FILL_DIRECTIONS.some(([key])=>key===fillDirection))fillDirection='top-left';
    const TAGS_KEY=`${KEY}:studentTags:${group}`;
    let studentTags;try{studentTags=cleanTags(JSON.parse(GM_getValue(TAGS_KEY,'{}')));}catch{studentTags={};}
    let tagsHidden=Boolean(GM_getValue(KEY+':tagsHidden',false));
    let rosterDialog=null;
    let applying=false,dirty=false,last=initial,undo=[],nativeDragStart=null;
    const cellAt=s=>table.rows[s.row]?.cells[s.col];
    const point=cell=>({row:cell.parentElement.rowIndex,col:cell.cellIndex});
    let seatIndex=new Map(),seatIndexSource=null,seatIndexLength=-1;
    const seatAt=cell=>{if(seatIndexSource!==seats||seatIndexLength!==seats.length){seatIndex=new Map(seats.map(s=>[coord(s),s]));seatIndexSource=seats;seatIndexLength=seats.length;}return seatIndex.get(coord(point(cell)));};
    const isOccupied=cell=>cards.some(card=>cell.contains(card));
    const gridSize=()=>({rows:table.rows.length,cols:Math.max(...[...table.rows].map(r=>r.cells.length))});
    const panel=document.createElement('section');panel.id='wsp-panel';
    panel.innerHTML=`<style>
body.wsp-page .container{width:auto!important;max-width:none!important}
.wsp-layout{display:grid;grid-template-columns:minmax(0,1fr) 274px;gap:12px;align-items:start;width:100%;min-width:0}
.wsp-board{position:relative;min-width:0;padding:25px 25px 8px;box-sizing:border-box;background:white;border:1px solid #d9e0e8;border-radius:8px}
.wsp-surface{width:100%;max-width:100%;min-width:0;overflow-x:auto}
#wsp-panel{background:#f5f8fc;border:1px solid #bac9db;border-radius:8px;padding:11px;margin:0;font:12px system-ui;color:#182838;box-sizing:border-box;max-width:100%;position:sticky;top:10px}
#wsp-panel h3{font-size:15px;margin:0 0 8px;border:0}#wsp-panel h4{font-size:12px;font-weight:700;margin:12px 0 6px}
#wsp-panel .wsp-row{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin:6px 0}
#wsp-panel button,#wsp-panel select,#wsp-panel input{font:inherit;padding:5px;border:1px solid #aab8c8;border-radius:4px;background:white;color:#182838}
#wsp-panel button{cursor:pointer;white-space:normal}#wsp-panel .wsp-row button{flex:1 1 auto}#wsp-panel label{display:block;width:100%;margin:5px 0}#wsp-panel select{width:100%;max-width:100%;margin-top:4px}
#wsp-panel .wsp-primary{background:#245f99;color:white;border-color:#245f99;width:100%;padding:9px}#wsp-panel p{margin:6px 0;font-size:11px;line-height:1.4}
#wsp-panel .wsp-tabs{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1.12fr) minmax(0,.76fr);gap:3px;margin:9px 0;border-bottom:1px solid #bac9db}
#wsp-panel .wsp-tabs > button{box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:36px!important;height:auto!important;margin:0!important;font:600 11px/1.25 system-ui!important;padding:6px 2px!important;white-space:normal!important;overflow-wrap:anywhere!important;overflow:hidden!important;border:0!important;border-bottom:3px solid transparent!important;border-radius:0!important;background:transparent!important}
#wsp-panel .wsp-tabs > button[aria-selected=true]{border-bottom-color:#245f99!important;color:#245f99!important}
.wsp-board-actions{margin-top:12px;border-top:1px solid #d9e0e8;padding-top:10px;font:12px/1.4 system-ui;color:#182838}
.wsp-board-actions .wsp-row{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}
.wsp-board-actions button,.wsp-board-actions select{font:inherit!important;border:1px solid #aab8c8;border-radius:4px;background:white;color:#182838;padding:7px;box-sizing:border-box;max-width:100%;height:auto!important;min-height:0!important}
.wsp-board-actions button,.wsp-board-actions summary{cursor:pointer}.wsp-board-actions summary{font-weight:600;padding:5px 0}
.wsp-board-actions label{display:block;margin:8px 0}.wsp-board-actions select{width:100%;margin-top:4px}
.wsp-board-actions .wsp-primary{background:#245f99;color:white;border-color:#245f99}.wsp-board-actions [hidden]{display:none!important}
#wsp-panel [hidden]{display:none!important}#wsp-panel details{margin-top:12px}#wsp-panel summary{cursor:pointer}#wsp-panel [role=status]{font-weight:600;border-top:1px solid #d7dfe8;padding-top:8px;margin-top:10px}
table.wsp-grid{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;border-collapse:separate!important;border-spacing:2px!important}
table.wsp-grid td,table.wsp-grid th{position:relative;box-sizing:border-box!important;min-width:0!important;max-width:none!important;vertical-align:middle!important;padding:2px!important;overflow:hidden}
table.wsp-grid td::before,table.wsp-grid td::after{content:none!important;display:none!important;pointer-events:none!important}
table.wsp-grid .wsp-native-placeholder{display:none!important;pointer-events:none!important}
table.wsp-grid .wsp-empty-card{z-index:1!important;isolation:isolate;opacity:1!important;transition:none!important}
table.wsp-grid .wsp-empty-card .wsp-remove-seat{position:absolute!important;left:2px!important;bottom:2px!important;top:auto!important;right:auto!important;width:22px!important;height:22px!important;z-index:20!important;pointer-events:auto!important;transition:none!important}
table.wsp-grid .wsp-seat-label{position:relative!important;z-index:1!important;flex:1 1 auto!important;width:calc(100% - 28px)!important;margin:0 0 0 24px!important}
table.wsp-grid .wsp-group-badge{width:auto!important;height:auto!important;max-width:calc(100% - 6px)!important;bottom:auto!important;right:auto!important;pointer-events:none!important}
table.wsp-grid .wsp-group-badge input,table.wsp-grid .wsp-group-badge button{pointer-events:auto!important}
table.wsp-grid .wsp-aisle{background:#fff!important;box-shadow:none!important;border-color:#fff!important}
table.wsp-grid .wsp-seat{background:#e1e4e8!important;box-shadow:inset 0 0 0 1px #aab2bc!important}
table.wsp-grid .wsp-named{background:#eee6fa!important;box-shadow:inset 0 0 0 1px #aa8dc9!important}
table.wsp-grid .wsp-occupied{background:#f1f5fa!important}
table.wsp-grid .wsp-empty-locked{outline:2px dashed #b68122;outline-offset:-3px}
table.wsp-grid .wsp-conflict{outline:2px solid #b52f2f!important}
body.wsp-photos-hidden table.wsp-grid .ui-draggable:not(.wsp-empty-card) img,body.wsp-photos-hidden > .ui-draggable img{display:none!important}
table.wsp-grid .ui-draggable:not(.wsp-empty-card){box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:100%!important;height:auto!important;min-height:0!important;margin:0!important;padding:18px 3px 3px!important;font-size:var(--wsp-font,12px)!important;line-height:1.15!important;float:none!important}
table.wsp-grid .ui-draggable:not(.wsp-empty-card) img{display:block!important;width:var(--wsp-photo,42px)!important;height:var(--wsp-photo,42px)!important;max-width:100%!important;object-fit:cover!important;margin:0 auto 2px!important}
table.wsp-grid .ui-draggable:not(.wsp-empty-card) p{display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden!important;overflow-wrap:anywhere!important;margin:2px 0!important;font-size:inherit!important;line-height:1.15!important}
.wsp-foreign-card{border:1px solid #bac9db;border-radius:4px;background:white;text-align:center}
#wsp-roster .wsp-import-box{background:#f2f6fb;border:1px solid #d8e1ec;border-radius:6px;padding:10px;margin:12px 0}#wsp-roster .wsp-import-box label{display:block;margin:5px 0}#wsp-roster .wsp-source-row{display:flex;gap:6px;align-items:center;margin:7px 0}#wsp-roster .wsp-source-row input{flex:1}#wsp-roster .wsp-preview{max-height:200px;overflow:auto}#wsp-roster .wsp-preview label{display:block}#wsp-roster .wsp-preview input{margin-right:6px}
table.wsp-grid .wsp-source-hidden{visibility:hidden!important;pointer-events:none!important}
.wsp-student-tag{display:block;font:9px/1.1 system-ui!important;color:#77818e;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
#wsp-roster{width:min(900px,95vw);max-height:85vh;overflow:auto;box-sizing:border-box;border:1px solid #b6c4d4;border-radius:10px;padding:18px;font:13px system-ui;color:#182838;background:white}#wsp-roster::backdrop{background:#172b4266}#wsp-roster h3{margin:0 0 10px}#wsp-roster table{width:100%;border-collapse:collapse;table-layout:fixed}#wsp-roster th,#wsp-roster td{text-align:left;padding:7px;border-bottom:1px solid #e1e7ee;overflow-wrap:anywhere}#wsp-roster input[type=text]{box-sizing:border-box;width:100%;min-width:0;padding:6px;border:1px solid #bdc9d7;border-radius:4px;font:inherit}#wsp-roster button{padding:7px 12px;border:1px solid #9eafc2;border-radius:4px;background:#f3f7fb;color:#182838;cursor:pointer}#wsp-roster .wsp-dialog-bar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}#wsp-roster .wsp-dialog-help{font-size:12px;color:#657487}#wsp-roster th:last-child{width:55px}
table.wsp-grid .wsp-empty-card{background:none!important;background-image:none!important;box-shadow:none!important;border:0!important;float:none!important;max-width:none!important;margin:0!important;box-sizing:border-box;width:100%!important;height:var(--wsp-empty-height,70px)!important;padding:20px 6px 5px!important;display:flex!important;gap:2px;align-items:center;justify-content:center;font:11px system-ui;cursor:grab;position:relative;user-select:none}
table.wsp-grid .wsp-empty-card::before,table.wsp-grid .wsp-empty-card::after{content:none!important;display:none!important}
table.wsp-grid input.wsp-seat-label{appearance:none!important;box-shadow:none!important;background-image:none!important;height:auto!important;float:none!important;max-width:none!important;margin:0!important;width:100%;min-width:0;box-sizing:border-box;border:1px solid transparent!important;border-radius:3px;background:transparent!important;color:#68717b!important;text-align:center;font:11px system-ui!important;padding:3px 1px!important;cursor:text}
.wsp-named .wsp-seat-label{color:#69468c!important}.wsp-seat-label:hover,.wsp-seat-label:focus{border-color:#9eafbf!important;background:#fff!important;outline:none}
.wsp-empty-card.ui-draggable-dragging{width:85px!important;height:70px!important;background:#e1e4e8;border:1px dashed #667b90;box-shadow:0 3px 12px #0002}
.wsp-empty-lock{position:absolute;bottom:3px;right:4px;font:10px system-ui}.wsp-locked{outline:3px solid #c58612!important}
.wsp-group-badge{position:absolute;left:3px;top:2px;z-index:4;display:flex;align-items:center;gap:1px;background:#eef2f8dd;border-radius:3px;padding:1px 2px;color:#405777;font:9px system-ui}
.wsp-group-number{width:25px;min-width:0;border:0!important;background:transparent!important;color:inherit!important;font:10px system-ui!important;padding:0!important;text-align:center;appearance:textfield;-moz-appearance:textfield}
.wsp-group-number::-webkit-inner-spin-button,.wsp-group-number::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.wsp-group-number:focus{background:white!important;outline:1px solid #597eab}
.wsp-group-reset{border:0;background:transparent;padding:0 1px;font:9px system-ui;color:#59718a;cursor:pointer;opacity:0}.wsp-seat:hover .wsp-group-reset,.wsp-group-reset:focus-visible{opacity:1}
.wsp-add-seat{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:21px;height:21px;padding:0;border:1px solid #8195a8;border-radius:50%;background:#f4f7fa;color:#245f99;font:17px/19px system-ui;opacity:0;cursor:pointer;z-index:3}
.wsp-aisle:hover .wsp-add-seat,.wsp-add-seat:focus-visible{opacity:1}.wsp-add-seat:hover{background:#245f99;color:white}
.wsp-remove-seat{position:absolute;bottom:2px;left:2px;width:18px;height:18px;padding:0;border:1px solid #b86f6f;border-radius:50%;background:white;color:#a52c2c;font:14px/15px system-ui;opacity:0;cursor:pointer;z-index:3}
.wsp-seat:not(.wsp-occupied):hover .wsp-remove-seat,.wsp-remove-seat:focus-visible{opacity:1}.wsp-remove-seat:hover{background:#a52c2c;color:white}
.wsp-edge{position:absolute;width:21px;height:21px;border:1px solid #7c94ad;border-radius:50%;background:white;color:#245f99;font:17px/18px system-ui;cursor:pointer;opacity:0;z-index:5;transform:translate(-50%,-50%);padding:0}
.wsp-edge.wsp-remove-axis{border-color:#bf8b8b;color:#a52c2c}.wsp-edge:hover,.wsp-edge:focus-visible{opacity:1!important;background:#245f99;color:white}.wsp-edge.wsp-remove-axis:hover{background:#a52c2c}
.wsp-board:hover .wsp-edge{opacity:.55}
@media(max-width:1100px){.wsp-layout{grid-template-columns:minmax(0,1fr) 245px;gap:8px}#wsp-panel{padding:9px}.wsp-board{padding-left:23px;padding-right:5px}}
@media(max-width:760px){.wsp-layout{grid-template-columns:minmax(0,1fr)}#wsp-panel{position:static}.wsp-edge{opacity:.7}}

html body table.wsp-grid td > div.wsp-group-badge {
  all:initial!important;
  box-sizing:border-box!important;
  position:absolute!important;left:3px!important;top:2px!important;right:auto!important;bottom:auto!important;
  display:inline-flex!important;flex-direction:row!important;flex-wrap:nowrap!important;
  align-items:center!important;justify-content:flex-start!important;gap:1px!important;
  width:max-content!important;max-width:calc(100% - 6px)!important;min-width:0!important;
  height:18px!important;min-height:18px!important;max-height:18px!important;
  margin:0!important;padding:1px 2px!important;overflow:hidden!important;
  font:9px/14px system-ui!important;color:#405777!important;white-space:nowrap!important;
  background:#eef2f8dd!important;border:0!important;border-radius:3px!important;
  z-index:4!important;pointer-events:none!important;
}
html body table.wsp-grid td > div.wsp-group-badge > input.wsp-group-number {
  all:initial!important;box-sizing:border-box!important;display:block!important;
  flex:0 0 25px!important;width:25px!important;min-width:0!important;max-width:25px!important;
  height:14px!important;min-height:14px!important;max-height:14px!important;
  margin:0!important;padding:0!important;border:0!important;background:transparent!important;
  font:10px/14px system-ui!important;color:#405777!important;text-align:center!important;
  appearance:textfield!important;pointer-events:auto!important;
}
html body table.wsp-grid td > div.wsp-group-badge > span.wsp-group-count {
  all:initial!important;display:block!important;flex:0 0 auto!important;
  height:14px!important;min-height:0!important;max-height:14px!important;
  margin:0!important;padding:0!important;font:9px/14px system-ui!important;
  color:#405777!important;white-space:nowrap!important;pointer-events:none!important;
}
html body table.wsp-grid td > div.wsp-group-badge > button.wsp-group-reset {
  all:initial!important;box-sizing:border-box!important;display:block!important;
  flex:0 0 12px!important;width:12px!important;min-width:0!important;max-width:12px!important;
  height:14px!important;min-height:0!important;max-height:14px!important;
  margin:0!important;padding:0!important;border:0!important;background:transparent!important;
  font:10px/14px system-ui!important;color:#59718a!important;text-align:center!important;
  cursor:pointer!important;pointer-events:auto!important;opacity:0!important;
}
html body table.wsp-grid td:hover > div.wsp-group-badge > button.wsp-group-reset,
html body table.wsp-grid td > div.wsp-group-badge > button.wsp-group-reset:focus-visible {opacity:1!important}
html body table.wsp-grid td > div.wsp-group-badge::before,
html body table.wsp-grid td > div.wsp-group-badge::after {content:none!important;display:none!important}

</style>
<h3>Istumajärjestys</h3>
<div class="wsp-tabs" role="tablist" aria-label="Istumajärjestyksen asetukset">
<button type="button" role="tab" id="wsp-students-tab" data-tab="students" aria-selected="true" aria-controls="wsp-students">Istumajärjestys</button>
<button type="button" role="tab" id="wsp-desks-tab" data-tab="desks" aria-selected="false" aria-controls="wsp-desks">Pöytäjärjestys</button>
<button type="button" role="tab" id="wsp-settings-tab" data-tab="settings" aria-selected="false" aria-controls="wsp-settings">Asetukset</button>
</div>
<div id="wsp-students" data-pane="students" role="tabpanel" aria-labelledby="wsp-students-tab">
<label>Oppilasjärjestys<select data-role="arrangements"><option value="">Valitse järjestys</option></select></label>
<div class="wsp-row"><button data-action="loadArrangement">Palauta</button><button data-action="saveArrangement">Tallenna uutena</button><button data-action="updateArrangement">Päivitä</button></div>
<details><summary>Tallenteen hallinta</summary><div class="wsp-row"><button data-action="renameArrangement">Nimeä</button><button data-action="deleteArrangement">Poista</button></div></details>
<div class="wsp-row"><button data-action="undo">Kumoa</button><button data-action="unlock">Vapauta lukitukset</button></div>
<h4>Wilma-tallennus</h4><p data-role="saveMode"></p><div class="wsp-row"><button data-action="saveGroups">Tallenna opetusryhmiin Wilmaan</button></div>
<p>Alt-napsautus lukitsee oppilaan nykyiselle paikalleen. Arvonta ja kopiointi löytyvät istumajärjestyksen alta.</p>
</div>
<div id="wsp-desks" data-pane="desks" role="tabpanel" aria-labelledby="wsp-desks-tab" hidden>
<h4>Pöytäjärjestys ja paikat</h4><label>Pohja<select data-role="layouts"><option value="">Valitse pöytäjärjestys</option></select></label>
<div class="wsp-row"><button data-action="loadLayout">Ota käyttöön</button><button data-action="saveLayout">Tallenna uutena</button><button data-action="updateLayout">Päivitä valittu</button></div>
<details><summary>Pohjan hallinta</summary><div class="wsp-row"><button data-action="renameLayout">Nimeä</button><button data-action="deleteLayout">Poista</button></div></details>
<details data-role="editorDetails"><summary>Pohjaeditori</summary>
<label>Paikkoja yhteensä <input data-role="editorTotal" type="number" min="1" max="10000" style="width:85px"></label>
<div class="wsp-editor-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
<label>Pöytäryhmiä <input data-role="editorGroups" type="number" min="1" max="999" value="6" style="width:100%;box-sizing:border-box"></label>
<label>Ryhmiä vierekkäin <input data-role="editorAcross" type="number" min="1" max="999" value="3" style="width:100%;box-sizing:border-box"></label>
<label>Pöytärivejä / ryhmä <input data-role="editorRows" type="number" min="1" max="100" value="2" style="width:100%;box-sizing:border-box"></label>
<label>Pöytäsarakkeita / ryhmä <input data-role="editorCols" type="number" min="1" max="100" value="2" style="width:100%;box-sizing:border-box"></label>
</div><p data-role="editorSummary" aria-live="polite"></p><div data-role="editorPreview" aria-label="Pöytäjärjestyksen esikatselu"></div>
<label>Pohjan nimi <input data-role="editorName" type="text" maxlength="100" placeholder="Oma pöytäjärjestys" style="width:100%;box-sizing:border-box"></label><div class="wsp-row"><button data-action="applyEditor">Ota käyttöön</button><button data-action="saveEditor">Tallenna pohja</button></div>
<p>Kokonaispaikkamäärä jaetaan tasaisesti ryhmiin. Tarvittaessa ryhmiin lisätään pöytärivejä. Ryhmien väliin ja reunoille jää käytävä. Käyttöönotto sijoittaa nykyiset oppilaat uuden pohjan paikoille. Voit tallentaa pohjan omalla nimellä.</p>
</details>
<p data-role="seatCount"></p>
<div class="wsp-row"><button data-action="undo">Kumoa</button></div>
<details><summary>Muokkaus suoraan ruudukossa</summary><p>Valkoisen ruudun + lisää pöydän ja tyhjän pöydän × poistaa sen. Raahaa tyhjä pöytä valkoiseen ruutuun. Reunaan lisätyn tai siirretyn pöydän ulkopuolelle syntyy automaattisesti käytävä.</p><p>Muokkaa pöydän ”tyhjä”-tekstiä suoraan. Esimerkiksi opettajan pöytä: nimeä ja Alt-lukitse se tyhjäksi. Pelkkä nimen muuttaminen ei lukitse pöytää.</p><p>Ryhmämerkin numeroa voi muuttaa suoraan pöydässä. Sama numero yhdistää pöydät samaan ryhmään. Numeron vieressä näkyy ryhmän paikkamäärä. ↺ palauttaa automaattisen ryhmän.</p><p>Paikat, nimet, lukitukset ja ryhmänumerot tallentuvat automaattisesti tälle ryhmälle. Valmiit pohjat käyttävät yllä määritettyä paikkamäärää.</p></details>
</div>
<div id="wsp-settings" data-pane="settings" role="tabpanel" aria-labelledby="wsp-settings-tab" hidden>
<h4>Oppilaat ja opetusryhmät</h4><div class="wsp-row"><button data-action="roster">Oppilaslista ja tunnisteet</button></div><h4>Näkyvyys</h4><div class="wsp-row"><button data-action="photos" aria-pressed="false">Piilota kuvat</button></div><h4>Varmuuskopiot</h4><div class="wsp-row"><button data-action="exportLayouts">Vie pöytäjärjestykset</button><button data-action="exportAll">Vie kaikki</button><button data-action="import">Tuo JSON</button></div><input data-role="file" type="file" accept=".json,application/json" hidden>
<p>Kaikkien tietojen vienti sisältää opiskelijatietoja. Tallenteet säilyvät Tampermonkeyssa.</p><h4>Tuntimerkinnät</h4><a data-role="attendance">Avaa tuntimerkinnät</a><p>Merkintöjen tekeminen istumajärjestyksestä lisätään, kun Wilman lomakkeen toiminta on varmistettu.</p>
</div><p role="status" aria-live="polite"></p>`;
    const surface=table.parentElement;
    const shell=document.createElement('div');shell.className='wsp-layout';
    const board=document.createElement('div');board.className='wsp-board';
    const edges=document.createElement('div');edges.className='wsp-edges';
    const boardTools=document.createElement('section');boardTools.className='wsp-board-actions';
    boardTools.innerHTML=`<details data-role="randomDetails"><summary>Arvo opiskelijat paikoille</summary>
<label>Arvonnan paikat<select data-role="drawMode"><option value="empty-first">Ensisijaisesti tyhjät paikat</option><option value="all">Kaikki käytettävissä olevat paikat</option><option value="current">Vain opiskelijoiden nykyiset paikat</option></select></label>
<label><input data-role="fillEnabled" type="checkbox"> Täytä paikat suunnassa</label><select data-role="fillDirection" aria-label="Paikkojen täyttösuunta"></select>
<p>Opiskelijat arvotaan valituille paikoille. Täyttösuunta määrää käytettävien paikkojen järjestyksen. Oppilaiden ja tyhjien paikkojen lukitukset säilyvät.</p>
<button type="button" class="wsp-primary" data-action="shuffle">Arvo opiskelijat paikoille</button></details>
<div class="wsp-row"><button type="button" data-action="tags" aria-pressed="false">Piilota tunnisteet</button><button type="button" data-action="copyList">Kopioi oppilaslista leikepöydälle</button><button type="button" data-action="copyTables">Kopioi nimet pöytäryhmittäin</button></div>`;
    surface.before(shell);board.append(surface,edges,boardTools);shell.append(board,panel);
    const $=role=>shell.querySelector(`[data-role="${role}"]`);
    const status=message=>{panel.querySelector('[role=status]').textContent=message;};
    const run=async action=>{try{await action();}catch(e){status(e.message);}};
    $('attendance').href=`/groups/${group}/attendance_edit`;
    $('attendance').target='_blank';$('attendance').rel='noopener';
    const chosen=kind=>{
      const selected=$(kind).value;
      if(kind==='layouts'&&selected.startsWith('builtin-'))return makePreset(selected.slice(8),presetCount());
      const entry=db[kind].find(item=>item.id===selected);
      if(!entry)throw Error('Valitse ensin tallenne.');return entry;
    };
    function refresh() {
      for(const kind of ['layouts','arrangements']){
        const select=$(kind),selected=select.value,placeholder=select.options[0].text;
        select.replaceChildren(new Option(placeholder,''));
        if(kind==='layouts'){
          const group=document.createElement('optgroup');group.label=`Valmiit pohjat · ${presetCount()} paikkaa`;
          for(const [key,name] of PRESETS)group.append(new Option(name,`builtin-${key}`));select.append(group);
        }
        for(const item of db[kind].filter(item=>kind==='layouts'||item.group===group))select.add(new Option(item.name,item.id));
        select.value=selected;if(select.selectedIndex<0)select.selectedIndex=0;
      }
      if(orderMenu){
        for(const old of orderMenu.querySelectorAll('optgroup[data-wsp]'))old.remove();
        for(const builtin of [true,false]){
          const options=document.createElement('optgroup');options.dataset.wsp='1';options.label=builtin?`Valmiit pöytäjärjestykset · ${presetCount()} paikkaa`:'Tallennetut pöytäjärjestykset';
          if(builtin)for(const [key,name] of PRESETS)options.append(new Option(name,`wsp:builtin-${key}`));
          else for(const entry of db.layouts)options.append(new Option(entry.name,`wsp:${entry.id}`));
          orderMenu.append(options);
        }
      }
    }
    $('layouts').addEventListener('change',()=>run(()=>{if($('layouts').value)useLayout(chosen('layouts'));}));
    for(const [key,label] of FILL_DIRECTIONS)$('fillDirection').add(new Option(label,key));
    $('drawMode').value=drawMode;$('drawMode').addEventListener('change',()=>{drawMode=$('drawMode').value;GM_setValue(KEY+':drawMode',drawMode);});
    $('fillEnabled').checked=fillEnabled;$('fillDirection').value=fillDirection;$('fillDirection').disabled=!fillEnabled;
    $('fillEnabled').addEventListener('change',()=>{fillEnabled=$('fillEnabled').checked;$('fillDirection').disabled=!fillEnabled;GM_setValue(KEY+':fillEnabled',fillEnabled);});
    $('fillDirection').addEventListener('change',()=>{fillDirection=$('fillDirection').value;GM_setValue(KEY+':fillDirection',fillDirection);});
    $('editorTotal').value=String(seats.length);
    function presetCount(){const n=Number($('editorTotal').value);return Number.isInteger(n)&&n>0&&n<=10000?n:Math.max(1,seats.length);}
    document.body.classList.add('wsp-page');table.classList.add('wsp-grid');surface.classList.add('wsp-surface');main.style.minWidth='0';main.style.maxWidth='100%';
    const jq=(typeof unsafeWindow!=='undefined'?unsafeWindow:window).jQuery;
    const template=[...table.querySelectorAll('td')].find(cell=>cell.classList.contains('ui-droppable')&&!cell.hasAttribute('title'))||table.querySelector('td');
    // Support dropdown plugins that emit jQuery-only change events.
    if(jq?.fn?.on)for(const select of [$('layouts'),orderMenu].filter(Boolean))jq(select).on('change.wspPlans',event=>{if(!event.originalEvent)select.dispatchEvent(new Event('change',{bubbles:true}));});
    const nativeOptions=jq?.data(template,'ui-droppable')?.options;
    const dropOptions=nativeOptions?{...nativeOptions}:null;
    const baseClasses=[...template.classList].filter(c=>!c.startsWith('ui-')&&!c.startsWith('wsp-')).join(' ');
    const wrapped=new WeakSet();
    function configureDrop(cell){
      if(!dropOptions||!jq?.fn?.droppable||wrapped.has(cell))return;
      const options=jq.data(cell,'ui-droppable')?.options;if(!options)return;
      const accept=options.accept,drop=options.drop;
      jq(cell).droppable('option',{
        accept:function(draggable){
          if(seatAt(cell)?.emptyLocked)return false;
          if(isCombined()&&cards.includes(draggable[0]))return true;
          if(draggable.hasClass('wsp-empty-card'))return !isOccupied(cell)&&!seatAt(cell);
          return typeof accept==='function'?accept.call(this,draggable):draggable.is(accept||'*');
        },
        drop:function(event,ui){
          if(seatAt(cell)?.emptyLocked)return;
          if(ui.draggable.hasClass('wsp-empty-card')){const from=ui.draggable[0].closest('td,th');run(()=>moveEmpty(from,cell));return;}
          if(isCombined()&&cards.includes(ui.draggable[0])){run(()=>moveCombinedStudent(ui.draggable[0],cell));return;}
          const empty=cell.querySelector('.wsp-empty-card');if(empty){destroyEmpty(empty);empty.remove();}
          if(typeof drop==='function')return drop.call(this,event,ui);
        }
      });wrapped.add(cell);
    }
    function destroyEmpty(marker){if(jq?.data(marker,'ui-draggable'))jq(marker).draggable('destroy');}
    function newCell(){const cell=document.createElement('td');cell.className=baseClasses;if(dropOptions&&jq?.fn?.droppable){jq(cell).droppable({...dropOptions});configureDrop(cell);}return cell;}
    for(const cell of table.querySelectorAll('td,th'))configureDrop(cell);
    function insertRaw(axis,index){
      const size=gridSize();
      if(axis==='row'){
        const row=document.createElement('tr');for(let c=0;c<size.cols;c++)row.append(newCell());
        if(index<size.rows)table.rows[index].before(row);else(table.tBodies[table.tBodies.length-1]||table).append(row);
      }else for(const row of [...table.rows]){const cell=newCell();if(index<row.cells.length)row.cells[index].before(cell);else row.append(cell);}
    }
    function ensureGrid(size){
      if(!size||size.rows>200||size.cols>200)throw Error('Ruudukon enimmäiskoko on 200 × 200.');
      while(gridSize().rows<size.rows)insertRaw('row',gridSize().rows);
      while(gridSize().cols<size.cols)insertRaw('col',gridSize().cols);
    }
    function dispose(cell){
      for(const marker of cell.querySelectorAll('.wsp-empty-card'))destroyEmpty(marker);
      if(jq?.data(cell,'ui-droppable'))jq(cell).droppable('destroy');
    }
    function trimGrid(size){
      for(const row of [...table.rows])while(row.cells.length>size.cols){const cell=row.cells[row.cells.length-1];dispose(cell);cell.remove();}
      while(table.rows.length>size.rows){const row=table.rows[table.rows.length-1];for(const cell of [...row.cells])dispose(cell);row.remove();}
    }
    function shiftSeats(axis,index,delta){const key=axis==='row'?'row':'col';seats=seats.map(s=>({...s,[key]:s[key]>=index?s[key]+delta:s[key]}));}
    function padEdges(){
      let changed=false;
      for(const axis of ['row','col']){
        const key=axis==='row'?'row':'col',sizeKey=axis==='row'?'rows':'cols';
        if(seats.some(s=>s[key]===0)&&gridSize()[sizeKey]<200){shiftSeats(axis,0,1);insertRaw(axis,0);changed=true;}
        const size=gridSize()[sizeKey];
        if(seats.some(s=>s[key]===size-1)&&size<200){insertRaw(axis,size);changed=true;}
      }
      if(changed)last=sync();return changed;
    }
    function remember(){undo.push({assignments:clone(last),seats:clone(seats),grid:gridSize(),locks:[...locks]});if(undo.length>30)undo.shift();}
    function sync(){const current=snapshot();if(!isCombined()){field.value=current.map(s=>`${s.student},${s.col+1},${s.row+1};`).join('');dirty=true;}else dirty=false;return current;}
    function saveWorking(){
      if(sharedId&&GM_getValue(`${KEY}:combined-link:${group}`,null)!==sharedId)return;
      const state={version:1,seats:clone(seats),grid:gridSize(),roster:isCombined()?rosterState():null,assignments:isCombined()?snapshot():null,sourceLabels:Object.fromEntries([...sources].map(([id,source])=>[id,source.label])),tags:clone(studentTags)};
      GM_setValue(WORKING_KEY,JSON.stringify(state));
      if(restoringShared)return;
      const oldId=GM_getValue(`${KEY}:combined-link:${group}`,null);
      if(sources.size>1){
        sharedId=sharedId||oldId||crypto.randomUUID();
        const old=JSON.parse(GM_getValue(`${KEY}:combined:${sharedId}`,'null'));
        for(const id of old?.members||[])if(!sources.has(id)&&GM_getValue(`${KEY}:combined-link:${id}`,null)===sharedId){GM_setValue(`${KEY}:combined-link:${id}`,null);const raw=GM_getValue(`${KEY}:working:${id}`,null);if(raw){try{const local=JSON.parse(raw);local.roster=null;local.assignments=null;GM_setValue(`${KEY}:working:${id}`,JSON.stringify(local));}catch{}}}
        const members=[...sources.keys()];GM_setValue(`${KEY}:combined:${sharedId}`,JSON.stringify({members,state}));
        for(const id of members)GM_setValue(`${KEY}:combined-link:${id}`,sharedId);
      }else if(sharedId||oldId){
        const id=sharedId||oldId,old=JSON.parse(GM_getValue(`${KEY}:combined:${id}`,'null'));
        for(const member of old?.members||[])if(GM_getValue(`${KEY}:combined-link:${member}`,null)===id){GM_setValue(`${KEY}:combined-link:${member}`,null);const raw=GM_getValue(`${KEY}:working:${member}`,null);if(raw){try{const state=JSON.parse(raw);state.roster=null;state.assignments=null;GM_setValue(`${KEY}:working:${member}`,JSON.stringify(state));}catch{}}}
        GM_setValue(`${KEY}:combined:${id}`,null);sharedId=null;
      }
    }
    function restoreWorking(){
      sharedId=GM_getValue(`${KEY}:combined-link:${group}`,null);
      const shared=sharedId?JSON.parse(GM_getValue(`${KEY}:combined:${sharedId}`,'null')):null;
      const raw=shared?.members?.includes(group)?JSON.stringify(shared.state):GM_getValue(WORKING_KEY,null);if(!raw)return false;
      const state=JSON.parse(raw);
      if(shared&&state.tags)studentTags=cleanTags(state.tags);
      validate({version:1,layouts:[{id:'working',name:'Working',seats:state.seats,stations:state.stations||[],grid:state.grid}],arrangements:[]});
      if(state.version!==1||!state.grid)throw Error('Virheellinen automaattinen tallenne.');
      if(state.sourceLabels&&typeof state.sourceLabels==='object')for(const [id,value] of Object.entries(state.sourceLabels))if(sources.has(id)&&typeof value==='string'&&value.trim())sources.get(id).label=cleanGroupLabel(value)||sources.get(id).label;
      const restored=layoutSeats(state);
      if(state.roster){installRoster(state.roster,state.assignments||[],restored,state.grid,false,true);return true;}
      ensureGrid(state.grid);
      const live=snapshot();trimGrid({rows:Math.max(state.grid.rows,...live.map(s=>s.row+1)),cols:Math.max(state.grid.cols,...live.map(s=>s.col+1))});
      const merged=new Map(restored.map(s=>[coord(s),s]));for(const s of live)if(!merged.has(coord(s)))merged.set(coord(s),{row:s.row,col:s.col});
      seats=[...merged.values()];last=snapshot();return true;
    }
    function addEmpty(cell){
      if(isOccupied(cell)||seatAt(cell))return;
      last=snapshot();remember();seats.push(point(cell));padEdges();paint();status('Pöytä lisätty ja tallennettu.');
    }
    function moveEmpty(from,to){
      if(!from||!to||isOccupied(from)||isOccupied(to)||seatAt(to))throw Error('Siirrä tyhjä pöytä valkoiseen ruutuun.');
      const source=seatAt(from);if(!source)throw Error('Siirrettävää pöytää ei löydy.');
      last=snapshot();remember();const destination=point(to);seats=seats.map(s=>s===source?{...s,...destination}:s);padEdges();paint();status('Pöytä siirretty. Nimi, ryhmä ja tyhjä lukitus säilyivät.');
    }
    function insertAisle(axis,index){
      if(!dropOptions||!jq?.fn?.droppable)throw Error('Wilman siirtotoimintoa ei löydy. Päivitä sivu.');
      const size=gridSize();if((axis==='row'?size.rows:size.cols)>=200)throw Error('Ruudukko on liian suuri.');
      last=snapshot();remember();applying=true;shiftSeats(axis,index,1);insertRaw(axis,index);last=sync();applying=false;nativeDragStart=null;paint();status('Käytävä lisätty. Tallenna oppilassijoittelu myös Wilmaan.');
    }
    function removeAxis(axis,index){
      const size=gridSize(),key=axis==='row'?'row':'col';
      if((axis==='row'?size.rows:size.cols)<=1)throw Error('Viimeistä riviä tai saraketta ei voi poistaa.');
      if(snapshot().some(s=>s[key]===index))throw Error('Oppilaita sisältävää riviä tai saraketta ei voi poistaa.');
      last=snapshot();remember();applying=true;
      seats=seats.filter(s=>s[key]!==index).map(s=>({...s,[key]:s[key]>index?s[key]-1:s[key]}));
      if(axis==='row'){const row=table.rows[index];for(const cell of [...row.cells])dispose(cell);row.remove();}
      else for(const row of [...table.rows]){const cell=row.cells[index];dispose(cell);cell.remove();}
      last=sync();applying=false;nativeDragStart=null;paint();status('Rivi tai sarake poistettu. Kumoa palauttaa muutoksen. Tallenna oppilassijoittelu myös Wilmaan.');
    }
    function drawEdges(){
      const rect=board.getBoundingClientRect();edges.replaceChildren();
      const add=(axis,index,x,y,remove=false)=>{
        const button=document.createElement('button');button.type='button';button.className=remove?'wsp-edge wsp-remove-axis':'wsp-edge';button.textContent=remove?'−':'+';
        button.title=remove?(axis==='row'?'Poista tyhjä rivi':'Poista tyhjä sarake'):(axis==='row'?'Lisää käytävärivi':'Lisää käytäväsarake');button.setAttribute('aria-label',button.title);button.style.left=`${x}px`;button.style.top=`${y}px`;
        button.addEventListener('click',()=>run(()=>remove?removeAxis(axis,index):insertAisle(axis,index)));edges.append(button);
      };
      const live=snapshot(),occupiedRows=new Set(live.map(s=>s.row)),occupiedCols=new Set(live.map(s=>s.col));
      const first=table.rows[0];if(!first)return;
      [...first.cells].forEach((cell,c)=>{const box=cell.getBoundingClientRect();add('col',c,box.left-rect.left,12);if(!occupiedCols.has(c)&&first.cells.length>1)add('col',c,(box.left+box.right)/2-rect.left,12,true);});
      add('col',first.cells.length,first.cells[first.cells.length-1].getBoundingClientRect().right-rect.left,12);
      [...table.rows].forEach((row,r)=>{const box=row.getBoundingClientRect();add('row',r,12,box.top-rect.top);if(!occupiedRows.has(r)&&table.rows.length>1)add('row',r,12,(box.top+box.bottom)/2-rect.top,true);});
      add('row',table.rows.length,12,table.rows[table.rows.length-1].getBoundingClientRect().bottom-rect.top);
    }
    function physicalGroups(){
      const pending=new Map(ordered(seats).map(s=>[coord(s),s])),groups=[];
      while(pending.size){
        const first=pending.values().next().value;pending.delete(coord(first));const members=[first];
        for(let i=0;i<members.length;i++)for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){const key=coord({row:members[i].row+dr,col:members[i].col+dc});if(pending.has(key)){members.push(pending.get(key));pending.delete(key);}}
        groups.push(ordered(members));
      }return groups;
    }
    function tableGroups(){
      const groups=new Map();physicalGroups().forEach((members,index)=>{for(const seat of members){const number=seat.group||index+1;if(!groups.has(number))groups.set(number,[]);groups.get(number).push(seat);}});
      return [...groups].sort((a,b)=>a[0]-b[0]).map(([number,members])=>{const result=ordered(members);result.number=number;return result;});
    }
    function fitGrid(){
      document.body.classList.toggle('wsp-photos-hidden',photosHidden);
      const selected=new Map(seats.map(s=>[coord(s),s])),occupiedKeys=new Set(snapshot().map(coord));
      const emptyCount=seats.filter(s=>!occupiedKeys.has(coord(s))).length,lockedEmpty=seats.filter(s=>s.emptyLocked).length;
      $('seatCount').textContent=`Paikkoja ${seats.length} · oppilaita ${cards.length} · tyhjiä ${emptyCount} · tyhjäksi lukittuja ${lockedEmpty}`;
      const groupData=new Map();for(const members of tableGroups()){const count=members.filter(s=>occupiedKeys.has(coord(s))).length;for(const seat of members)groupData.set(coord(seat),{number:members.number,total:members.length,occupied:count});}
      const activeRows=new Set(seats.map(s=>s.row)),activeCols=new Set(seats.map(s=>s.col));
      const columns=gridSize().cols,weights=Array.from({length:columns},(_,c)=>activeCols.has(c)?1:0.5),total=weights.reduce((a,b)=>a+b,0);
      const width=surface.clientWidth||main.clientWidth||900,seatWidth=Math.max(24,(width-columns*2)/total);
      const photo=photosHidden?0:Math.max(22,Math.min(54,seatWidth*0.5)),font=Math.max(9,Math.min(13,seatWidth*0.15)),height=Math.round(photo+font*2.3+30);
      table.style.setProperty('--wsp-photo',`${photo}px`);table.style.setProperty('--wsp-font',`${font}px`);table.style.setProperty('--wsp-empty-height',`${height-7}px`);
      [...table.rows].forEach((row,r)=>{
        const rowHeight=activeRows.has(r)?height:Math.round(height*0.5);row.style.setProperty('height',`${rowHeight}px`,'important');
        [...row.cells].forEach((cell,c)=>{
          const key=coord({row:r,col:c}),seat=selected.get(key),occupied=occupiedKeys.has(key);
          for(const child of cell.children){if(child.className?.baseVal!==undefined)continue;const own=typeof child.className==='string'&&child.className.split(/\s+/).some(n=>n.startsWith('wsp-')&&n!=='wsp-native-placeholder');if(!own&&!cards.some(card=>child===card||child.contains(card)))child.classList.add('wsp-native-placeholder');else child.classList.remove('wsp-native-placeholder');}
          cell.classList.toggle('wsp-seat',!!seat);cell.classList.toggle('wsp-aisle',!seat);cell.classList.toggle('wsp-occupied',occupied);
          cell.classList.toggle('wsp-named',!!seat?.label&&seat.label!=='tyhjä');cell.classList.toggle('wsp-empty-locked',!!seat?.emptyLocked);cell.classList.toggle('wsp-conflict',!!seat?.emptyLocked&&occupied);
          let badge=cell.querySelector('.wsp-group-badge');
          if(seat&&!badge){
            badge=document.createElement('div');badge.className='wsp-group-badge';badge.append(document.createTextNode('R'));
            const input=document.createElement('input');input.type='number';input.min='1';input.max='999';input.className='wsp-group-number';input.setAttribute('aria-label','Pöydän ryhmänumero');badge.append(input);
            const count=document.createElement('span');count.className='wsp-group-count';badge.append(count);
            const reset=document.createElement('button');reset.type='button';reset.className='wsp-group-reset';reset.textContent='↺';reset.title='Palauta automaattinen ryhmä';reset.setAttribute('aria-label',reset.title);badge.append(reset);cell.append(badge);
          }else if(!seat&&badge){badge.remove();badge=null;}
          if(badge){const data=groupData.get(key),input=badge.querySelector('.wsp-group-number');if(document.activeElement!==input)input.value=String(data.number);badge.querySelector('.wsp-group-count').textContent=`· ${data.total}`;badge.title=`Ryhmä ${data.number}: ${data.occupied} oppilasta / ${data.total} paikkaa. Muokkaa numeroa siirtääksesi pöydän toiseen ryhmään.`;}
          let add=cell.querySelector('.wsp-add-seat');
          if(!seat&&!occupied&&!add){add=document.createElement('button');add.type='button';add.className='wsp-add-seat';add.textContent='+';add.title='Lisää tyhjä pöytä';add.setAttribute('aria-label',add.title);cell.append(add);}else if((seat||occupied)&&add)add.remove();
          let empty=cell.querySelector('.wsp-empty-card');
          if(seat&&!occupied&&!empty){
            empty=document.createElement('div');empty.className='wsp-empty-card';
            const input=document.createElement('input');input.type='text';input.maxLength=100;input.className='wsp-seat-label';input.setAttribute('aria-label','Pöydän nimi');input.title='Muokkaa pöydän nimeä suoraan tässä. Alt-napsautus lukitsee paikan tyhjäksi.';empty.append(input);
            const lock=document.createElement('span');lock.className='wsp-empty-lock';empty.append(lock);
            const remove=document.createElement('button');remove.type='button';remove.className='wsp-remove-seat';remove.textContent='×';remove.title='Poista tyhjä pöytä';remove.setAttribute('aria-label',remove.title);empty.append(remove);cell.append(empty);
            if(jq?.fn?.draggable){jq(empty).draggable({helper:'clone',appendTo:'body',revert:'invalid',revertDuration:100,distance:2,zIndex:10000,cancel:'button,input,textarea,[contenteditable]'});empty.classList.remove('ui-draggable');}
          }else if((!seat||occupied)&&empty){destroyEmpty(empty);empty.remove();empty=null;}
          if(empty){const input=empty.querySelector('.wsp-seat-label');if(document.activeElement!==input)input.value=seat.label||'tyhjä';empty.querySelector('.wsp-empty-lock').textContent=seat.emptyLocked?'🔒':'';empty.title=seat.emptyLocked?'Lukittu tyhjäksi · Alt-napsautus vapauttaa':'Alt-napsautus lukitsee tämän pöydän tyhjäksi';}
          cell.style.setProperty('width',`${100*weights[c]/total}%`,'important');cell.style.setProperty('height',`${rowHeight}px`,'important');cell.style.setProperty('min-height','0','important');
        });
      });drawEdges();
    }
    function safeImage(value,base=location.href){
      if(typeof value!=='string'||!value.trim()||value.length>2000000)return '';
      if(/^data:image\/(?:png|jpeg|gif|webp|svg\+xml)[;,]/i.test(value))return value;
      try{const url=new URL(value,base);return url.origin===location.origin&&url.protocol==='https:'?url.href:'';}catch{return '';}
    }
    function sourceId(value){
      if(/^\d{1,32}$/.test(value.trim()))return value.trim();
      const url=new URL(value,location.origin),match=url.pathname.match(/^\/groups\/(\d+)(?:\/|$)/);
      if(url.origin!==location.origin||!match)throw Error('Anna tämän Wilman opetusryhmän linkki tai numerotunnus.');return match[1];
    }
    function sourceCards(doc){
      const candidates=[...doc.querySelectorAll('main table td div[id]')].filter(card=>/\d/.test(card.id)&&card.querySelector('img')&&card.querySelector('p'));
      return candidates.filter(card=>!candidates.some(other=>other!==card&&card.contains(other)));
    }
    function recordsFrom(doc,base){
      const records=sourceCards(doc).map(card=>{const cell=card.closest('td');return {student:card.id.match(/\d+/)?.[0],name:card.querySelector('p').textContent.trim().replace(/\s+/g,' '),image:safeImage(card.querySelector('img').getAttribute('src'),base),row:cell.parentElement.rowIndex,col:cell.cellIndex};});
      if(!records.length||new Set(records.map(s=>s.student)).size!==records.length||records.some(s=>!/^\d{1,32}$/.test(s.student)||!s.name||!validSeat(s)))throw Error('Opetusryhmän opiskelijalistaa ei voitu varmistaa.');
      return records;
    }
    function groupLinkId(link){
      try{
        const url=new URL(link.getAttribute('href'),location.origin);
        if(url.origin!==location.origin||url.search||url.hash)return null;
        return url.pathname.match(/^\/groups\/(\d+)(?:\/seating)?\/?$/)?.[1]||null;
      }catch{return null;}
    }
    function breadcrumbGroups(doc,currentId=null){
      const result=new Map();
      for(const crumb of doc.querySelectorAll('.breadcrumb li.dropdown, .breadcrumbs li.dropdown')){
        const links=[...crumb.querySelectorAll('.dropdown-menu a[href]')];
        const groupLinks=links.filter(link=>groupLinkId(link));
        if(!groupLinks.length)continue;
        for(const link of groupLinks){
          const name=cleanGroupLabel(link.textContent);
          if(name)result.set(groupLinkId(link),name);
        }
        // The current group's menu item is empty in Wilma. Its name is in
        // the active breadcrumb outside the dropdown menu.
        if(currentId&&!result.has(currentId)&&crumb.classList.contains('active')){
          const label=crumb.cloneNode(true);
          for(const menu of label.querySelectorAll('ul,ol,.dropdown-menu,[role="menu"],.caret,script,style'))menu.remove();
          const name=cleanGroupLabel(label.textContent);
          if(name)result.set(currentId,name);
        }
      }
      return result;
    }
    function groupName(doc,id){
      const menuName=breadcrumbGroups(doc,id).get(id);
      if(menuName)return menuName;
      const links=[...doc.querySelectorAll('a[href]')].filter(a=>groupLinkId(a)===id&&!a.closest('nav,.navbar,#wsp-panel,#wsp-roster'));
      const name=links.map(a=>cleanGroupLabel(a.textContent)).find(Boolean);
      if(name)return name;
      for(const a of links){const row=a.closest('tr');if(row&&!row.closest('table.wsp-grid')){const cells=[...row.querySelectorAll('th,td')];const candidate=cells.map(cell=>cleanGroupLabel(cell.textContent)).find(text=>text&&!/^\d+$/.test(text));if(candidate)return candidate;}}
      return cleanGroupLabel(doc.querySelector('main h1')?.textContent)||'Opetusryhmä';
    }
    function collectGroups(doc,currentId=null){
      const menu=breadcrumbGroups(doc,currentId);
      for(const [id,name] of menu)groupCatalog.set(id,{id,name});
      // A group index may also have direct group links. Do not let its
      // action links or labels overwrite the breadcrumb's group names.
      for(const a of doc.querySelectorAll('a[href]')){
        const id=groupLinkId(a);
        if(!id||groupCatalog.has(id)||a.closest('nav,.navbar,#wsp-panel,#wsp-roster'))continue;
        const name=cleanGroupLabel(a.textContent);
        if(name)groupCatalog.set(id,{id,name});
      }
      return menu.size;
    }
    async function refreshSourceNames(){
      collectGroups(document,group);
      let changed=false;
      for(const tag of Object.values(studentTags))if(tag.teachingGroup&&!cleanGroupLabel(tag.teachingGroup)){tag.teachingGroup='';changed=true;}
      for(const source of [...sources.values()]){
        if(cleanGroupLabel(source.label)&&source.label!=='Opetusryhmä')continue;
        const known=cleanGroupLabel(groupCatalog.get(source.id)?.name);
        if(known){source.label=known;changed=true;continue;}
        try{
          await readGroup(source.id);
          if(sources.get(source.id)!==source)continue;
          const name=cleanGroupLabel(groupCatalog.get(source.id)?.name);
          source.label=name||'Opetusryhmä';changed=true;
        }catch{source.label='Opetusryhmä';changed=true;}
      }
      if(changed){saveTags();saveWorking();renderTags();}
    }
    setTimeout(()=>{refreshSourceNames().catch(()=>{});},0);
    async function loadGroupCatalog(){
      if(collectGroups(document,group))return [...groupCatalog.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi'));
      const link=[...document.querySelectorAll('a[href]')].find(a=>{try{return /^\/groups\/?$/.test(new URL(a.getAttribute('href'),location.origin).pathname);}catch{return false;}});
      const url=new URL(link?.getAttribute('href')||'/groups',location.origin),response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok||new URL(response.url).origin!==location.origin||!/\/groups\/?$/.test(new URL(response.url).pathname))throw Error('Opetusryhmäluetteloa ei voitu avata. Voit lisätä ryhmän linkillä.');
      collectGroups(new DOMParser().parseFromString(await response.text(),'text/html'));
      if(!groupCatalog.size)throw Error('Ryhmien linkkejä ei löytynyt. Tarvitaan sanitoitu raportti opetusryhmäluettelon rakenteesta.');
      return [...groupCatalog.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi'));
    }
    function renderSourceVisibility(){
      for(const card of cards){const id=getStudent(card),members=[...sources.values()].filter(source=>source.students.some(s=>s.student===id));card.classList.toggle('wsp-source-hidden',members.length>0&&members.every(source=>hiddenSources.has(source.id)));}
    }
    function unlinkCombination(){
      const id=sharedId||GM_getValue(`${KEY}:combined-link:${group}`,null);
      const shared=id?JSON.parse(GM_getValue(`${KEY}:combined:${id}`,'null')):null;
      for(const member of shared?.members||[...sources.keys()]){
        if(!id||GM_getValue(`${KEY}:combined-link:${member}`,null)===id)GM_setValue(`${KEY}:combined-link:${member}`,null);
        const raw=GM_getValue(`${KEY}:working:${member}`,null);if(raw){try{const state=JSON.parse(raw);state.roster=null;state.assignments=null;GM_setValue(`${KEY}:working:${member}`,JSON.stringify(state));}catch{}}
      }
      if(id)GM_setValue(`${KEY}:combined:${id}`,null);sharedId=null;
      installRoster({sources:[{id:group,label:sources.get(group)?.label||groupName(document,group),students:clone(nativeRecords)}],active:[...nativeById.keys()]});
      status('Ryhmien yhdistäminen poistettu. Pöytäjärjestys säilyy; Wilman tallennetut paikat palautuvat sivun latauksella.');
    }
    async function readGroup(id){
      const url=new URL(`/groups/${id}/seating`,location.origin),response=await fetch(url,{credentials:'same-origin',cache:'no-store'}),actual=new URL(response.url);
      if(!response.ok||actual.origin!==location.origin||actual.pathname.replace(/\/$/,'')!==url.pathname)throw Error('Opetusryhmän sivu ei avaudu tai kirjautuminen on vanhentunut.');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html'),found=groupName(doc,id);groupCatalog.set(id,{id,name:found==='Opetusryhmä'?(groupCatalog.get(id)?.name||found):found});return recordsFrom(doc,response.url);
    }
    function rosterState(){return {sources:clone([...sources.values()]),active:[...activeIds]};}
    function cleanRoster(state){
      if(!state||!Array.isArray(state.sources)||!Array.isArray(state.active)||state.sources.length>30)throw Error('Virheellinen yhdistelmän kokoonpano.');
      const result=new Map();
      for(const source of state.sources){
        if(!source||typeof source.id!=='string'||!/^\d{1,32}$/.test(source.id)||result.has(source.id)||!Array.isArray(source.students)||source.students.length>2000)throw Error('Virheellinen lähdeopetusryhmä.');
        const students=source.id===group?clone(nativeRecords):source.students.map(s=>({student:String(s.student),name:typeof s.name==='string'?s.name.slice(0,200):'',image:safeImage(s.image),row:s.row,col:s.col}));
        if(new Set(students.map(s=>s.student)).size!==students.length||students.some(s=>!/^\d{1,32}$/.test(s.student)||!s.name||!validSeat(s)))throw Error('Virheellinen opiskelijatallenne.');
        result.set(source.id,{id:source.id,label:(cleanGroupLabel(source.label)||(source.id===group?groupName(document,group):'Opetusryhmä')),students});
      }
      if(!result.has(group))result.set(group,{id:group,label:'',students:clone(nativeRecords)});
      const known=new Set([...result.values()].flatMap(source=>source.students.map(s=>s.student))),active=[...new Set(state.active.map(String))].filter(id=>known.has(id));
      if(active.length>1000)throw Error('Yhdistelmän enimmäiskoko on 1000 opiskelijaa.');
      return {sources:result,active};
    }
    function planRoster(ids,preferred,nextSeats,desiredGrid,allowLockedPreferred=false){
      const layout=clearAutomaticLocks(nextSeats),selected=new Map(layout.map(s=>[coord(s),s])),byStudent=new Map(preferred.map(s=>[s.student,s])),used=new Set(),assigned=[],pending=[];
      if(!layout.length||!layout.every(validSeat)||new Set(layout.map(coord)).size!==layout.length)throw Error('Pöytäjärjestyksen paikat ovat virheellisiä.');
      for(const student of ids){const p=byStudent.get(student);if(p){if(!validSeat(p)||used.has(coord(p)))throw Error('Tallennetut opiskelijapaikat menevät päällekkäin.');if(selected.get(coord(p))?.emptyLocked&&!allowLockedPreferred)throw Error('Opiskelijan paikka on lukittu tyhjäksi. Vapauta lukitus ennen palautusta.');if(!selected.has(coord(p))){const seat={row:p.row,col:p.col};layout.push(seat);selected.set(coord(seat),seat);}assigned.push({row:p.row,col:p.col,student});used.add(coord(p));}else pending.push(student);}
      const free=ordered(layout.filter(s=>!s.emptyLocked&&!used.has(coord(s))));
      let row=Math.max(1,...layout.map(s=>s.row))+2;
      const columns=[...new Set(layout.filter(s=>!s.emptyLocked).map(s=>s.col))].sort((a,b)=>a-b);
      if(!columns.length)columns.push(1,2,3,4,5,6);
      while(free.length<pending.length){
        if(row>=199)throw Error('Ruudukossa ei ole tilaa uusille opiskelijoille. Lisää sopiva pöytäjärjestys tai vähennä opiskelijoita.');
        for(const col of columns){if(free.length>=pending.length)break;if(col>=200)continue;const seat={row,col};layout.push(seat);free.push(seat);}row+=2;
      }
      pending.forEach((student,i)=>assigned.push({row:free[i].row,col:free[i].col,student}));
      return {seats:layout,assignments:assigned,grid:{rows:Math.min(200,Math.max(desiredGrid?.rows||gridSize().rows,...layout.map(s=>s.row+2))),cols:Math.min(200,Math.max(desiredGrid?.cols||gridSize().cols,...layout.map(s=>s.col+2)))}};
    }
    function foreignCard(record){
      const card=document.createElement('div');card.id=`wsp-foreign-${record.student}`;card.className='wsp-foreign-card';
      const image=safeImage(record.image);if(image){const img=document.createElement('img');img.src=image;img.alt='';card.append(img);}
      const name=document.createElement('p');name.textContent=record.name;card.append(name);
      if(jq?.fn?.draggable)jq(card).draggable({helper:'clone',appendTo:'body',revert:'invalid',revertDuration:100,distance:2,zIndex:10000});
      else card.classList.add('ui-draggable');return card;
    }
    function installRoster(state,preferred=snapshot(),nextSeats=seats,desiredGrid=null,pad=true,allowLockedPreferred=false){
      const clean=cleanRoster(state),plan=planRoster(clean.active,preferred,nextSeats,desiredGrid,allowLockedPreferred);
      if(plan.grid.rows>200||plan.grid.cols>200)throw Error('Yhdistelmä ei mahdu ruudukkoon.');
      const known=new Map();for(const source of clean.sources.values())for(const record of source.students)if(!known.has(record.student))known.set(record.student,record);
      applying=true;ensureGrid(plan.grid);
      const previousCount=cards.length;
      const oldById=new Map(byId),wanted=new Set(clean.active);
      for(const [student,card] of oldById)if(!wanted.has(student)){if(!nativeById.has(student)&&jq?.data(card,'ui-draggable'))jq(card).draggable('destroy');card.remove();}
      for(const [student,card] of nativeById)if(!wanted.has(student))card.remove();
      sources.clear();for(const [id,source] of clean.sources)sources.set(id,source);activeIds=wanted;
      cards=clean.active.map(student=>nativeById.get(student)||oldById.get(student)||foreignCard(known.get(student)));byId=new Map(cards.map(card=>[getStudent(card),card]));
      if(cards.length>previousCount){const total=Number($('editorTotal').value);$('editorTotal').value=String(Math.max(Number.isFinite(total)?total:0,cards.length));}
      seats=plan.seats;for(const p of plan.assignments){const card=byId.get(p.student);cellAt(p).append(card);card.style.left='';card.style.top='';}
      for(const id of [...locks])if(!activeIds.has(id))locks.delete(id);
      last=snapshot();if(pad)padEdges();last=sync();applying=false;undo=[];nativeDragStart=null;paint();
    }
    function addStudents(source,selected){
      if(!selected.length)throw Error('Valitse vähintään yksi opiskelija.');
      const state=rosterState(),old=state.sources.find(s=>s.id===source.id);if(old){old.label=source.label;old.students=source.students;}else state.sources.push(source);
      state.active=[...new Set([...state.active,...selected])];installRoster(state);status(`Opetusryhmän ${source.label||'Opetusryhmä'} opiskelijat lisätty. Yhdistelmä tallentuu automaattisesti skriptiin; Wilma-tallennus tehdään Tallenna-painikkeella.`);
    }
    function removeStudent(student){const state=rosterState();state.active=state.active.filter(id=>id!==student);installRoster(state,snapshot().filter(s=>s.student!==student));status('Opiskelija poistettu tästä istumajärjestyksestä. Wilman ryhmäjäsenyys säilyy.');}
    function moveCombinedStudent(card,to){
      const student=getStudent(card),from=position(card),target=point(to);if(coord(from)===coord(target))return;
      const other=cards.find(c=>c!==card&&to.contains(c)),assignments=snapshot().map(s=>s.student===student?{...target,student}:other&&s.student===getStudent(other)?{row:from.row,col:from.col,student:s.student}:s),nextSeats=clone(seats);
      if(!nextSeats.some(s=>coord(s)===coord(target)))nextSeats.push(target);apply(assignments,nextSeats);padEdges();last=sync();paint();
    }
    function buildSourceControls(dialog){
      const box=document.createElement('section');box.className='wsp-import-box';
      const title=document.createElement('h4');title.textContent='Opetusryhmät ja kokoonpano';box.append(title);
      for(const source of sources.values()){
        const row=document.createElement('div');row.className='wsp-source-row';
        const label=document.createElement('span');label.textContent=source.label||'Opetusryhmä';
        const visible=document.createElement('input');visible.type='checkbox';visible.checked=!hiddenSources.has(source.id);visible.title='Näytä ryhmän opiskelijat';visible.addEventListener('change',()=>{if(visible.checked)hiddenSources.delete(source.id);else hiddenSources.add(source.id);GM_setValue(`${KEY}:hiddenSources:${group}`,JSON.stringify([...hiddenSources]));renderSourceVisibility();});row.append(visible);
        const alias=document.createElement('input');alias.type='text';alias.maxLength=60;alias.value=source.label;alias.placeholder='Lyhyt opetusryhmätunnus';alias.setAttribute('aria-label','Opetusryhmän tunnus');
        alias.addEventListener('input',()=>{source.label=alias.value;saveWorking();renderTags();});row.append(label,alias);
        if(source.id!==group){const remove=document.createElement('button');remove.type='button';remove.textContent='Poista ryhmä';remove.addEventListener('click',()=>run(()=>{const state=rosterState();state.sources=state.sources.filter(s=>s.id!==source.id);const known=new Set(state.sources.flatMap(s=>s.students.map(p=>p.student)));state.active=state.active.filter(id=>known.has(id));installRoster(state,snapshot().filter(s=>known.has(s.student)));openRoster();}));row.append(remove);}box.append(row);
      }
      const reset=document.createElement('button');reset.type='button';reset.textContent='Poista ryhmien yhdistäminen';reset.addEventListener('click',()=>run(()=>{unlinkCombination();openRoster();}));box.append(reset);
      const catalogLabel=document.createElement('label');catalogLabel.textContent='Opettajan opetusryhmät';const select=document.createElement('select');select.style.width='100%';select.append(new Option('Lataa opetusryhmät…',''));catalogLabel.append(select);box.append(catalogLabel);
      const catalogStatus=document.createElement('p');box.append(catalogStatus);
      loadGroupCatalog().then(groups=>{select.replaceChildren(new Option('Valitse lisättävä opetusryhmä',''));for(const item of groups)if(!sources.has(item.id))select.append(new Option(item.name,item.id));catalogStatus.textContent='Luettelossa Wilman opetusryhmäsivulta löytyvät ryhmät.';}).catch(e=>{catalogStatus.textContent=e.message;select.replaceChildren(new Option('Lisää ryhmä alla olevalla linkillä',''));});
      const groupLabel=document.createElement('label');groupLabel.textContent='Lisättävän opetusryhmän Wilma-linkki tai numerotunnus';const url=document.createElement('input');url.type='text';url.placeholder='https://espoo.inschool.fi/groups/…/seating';groupLabel.append(url);box.append(groupLabel);
      const aliasLabel=document.createElement('label');aliasLabel.textContent='Kortissa näytettävä opetusryhmätunnus';const alias=document.createElement('input');alias.type='text';alias.maxLength=60;alias.placeholder='Esim. FY1.2';aliasLabel.append(alias);box.append(aliasLabel);
      select.addEventListener('change',()=>{if(select.value){url.value=select.value;alias.value=groupCatalog.get(select.value)?.name||'';fetchButton.click();}});
      const fetchButton=document.createElement('button');fetchButton.type='button';fetchButton.textContent='Hae opetusryhmä';box.append(fetchButton);
      const message=document.createElement('p'),preview=document.createElement('div');preview.className='wsp-preview';box.append(message,preview);
      fetchButton.addEventListener('click',async()=>{
        fetchButton.disabled=true;preview.replaceChildren();message.textContent='Haetaan opiskelijalistaa…';
        try{
          const id=sourceId(url.value);const students=await readGroup(id),code=groupCatalog.get(id)?.name||alias.value.trim()||'Opetusryhmä',checkboxes=[];alias.value=code;
          const allLabel=document.createElement('label'),all=document.createElement('input');all.type='checkbox';all.checked=true;allLabel.append(all,document.createTextNode(` Valitse kaikki (${students.length})`));preview.append(allLabel);
          for(const student of students){const label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.dataset.student=student.student;label.append(checkbox,document.createTextNode(student.name));preview.append(label);checkboxes.push(checkbox);}
          all.addEventListener('change',()=>checkboxes.forEach(c=>c.checked=all.checked));
          const add=document.createElement('button');add.type='button';add.textContent='Lisää valitut istumajärjestykseen';add.addEventListener('click',()=>run(()=>{addStudents({id,label:code,students},checkboxes.filter(c=>c.checked).map(c=>c.dataset.student));openRoster();}));preview.append(add);message.textContent=`Opetusryhmä ${code}: ${students.length} opiskelijaa. Samat opiskelijat näytetään yhdistelmässä vain kerran.`;
        }catch(e){message.textContent=e.message;}finally{fetchButton.disabled=false;}
      });dialog.append(box);
    }
    const nativeSaveLabels=new WeakMap();
    function updateSaveMode(){
      const combined=isCombined();$('saveMode').textContent=combined?'Yhdistelmä käytössä. Tallenna tallentaa sijainnit jokaiseen lähdeopetusryhmään erikseen. Näkymästä poistetut opiskelijat säilyvät omissa opetusryhmissään.':'';
      for(const button of [...field.form?.elements||[]].filter(el=>el.type==='submit')){
        if(!nativeSaveLabels.has(button))nativeSaveLabels.set(button,{value:button.value,text:button.textContent,title:button.title});const original=nativeSaveLabels.get(button);
        if(button.tagName==='INPUT')button.value=combined?'Tallenna yhdistelmä':original.value;else button.textContent=combined?'Tallenna yhdistelmä':original.text;
        button.title=combined?'Tallentaa sijainnit kaikkiin lähdeopetusryhmiin Wilmaan':original.title;
      }
    }
    async function nativeGroupFrame(id){
      const frame=document.createElement('iframe');frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-20000px;top:0;width:1200px;height:800px;visibility:hidden;pointer-events:none';
      try{
        const loaded=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Opetusryhmän sivun lataus aikakatkaistiin.')),15000);frame.addEventListener('load',()=>{clearTimeout(timeout);resolve();},{once:true});frame.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Opetusryhmän sivu ei latautunut.'));},{once:true});});
        frame.src=new URL(`/groups/${id}/seating`,location.origin).href;document.body.append(frame);await loaded;
        const deadline=Date.now()+8000;
        while(Date.now()<deadline){
          const actual=new URL(frame.contentWindow.location.href);
          if(actual.origin!==location.origin||actual.pathname.replace(/\/$/,'')!==`/groups/${id}/seating`)throw Error('Lähdeopetusryhmän sivu ohjautui väärään näkymään.');
          const doc=frame.contentDocument;if(doc?.querySelector('main')){
            const cards=sourceCards(doc),records=recordsFrom(doc,frame.src);
            const fields=[...doc.querySelectorAll('main input[type=hidden]')].filter(input=>{if(!/^\d+,\d+,\d+(?:;\d+,\d+,\d+)*;?$/.test(input.value.trim()))return false;const rows=input.value.trim().replace(/;$/,'').split(';').map(s=>s.split(','));return rows.length===records.length&&records.every(s=>rows.some(r=>r[0]===s.student&&+r[1]===s.col+1&&+r[2]===s.row+1));});
            if(fields.length===1&&fields[0].form){const field=fields[0],form=field.form,action=new URL(form.getAttribute('action')||frame.src,frame.src),buttons=[...form.elements].filter(el=>el.type==='submit');if(form.method.toLowerCase()!=='post'||action.origin!==location.origin||buttons.length!==1)throw Error('Opetusryhmän tallennuslomaketta ei voitu varmistaa.');return {frame,doc,cards,records,field,form,submitter:buttons[0]};}
          }await new Promise(resolve=>setTimeout(resolve,200));
        }throw Error('Opetusryhmän tallennuskenttä ei alustunut.');
      }catch(e){frame.remove();throw e;}
    }
    function prepareNativeSave(context,assignments){
      if(context.form)context.form.target='_self';
      const cards=new Map(context.cards.map(card=>[card.id.match(/\d+/)[0],card]));
      const table=context.cards[0].closest('table'),rows=Math.max(...assignments.map(s=>s.row))+1,cols=Math.max(...assignments.map(s=>s.col))+1;
      const template=context.cards[0].closest('td'),pageJQ=context.frame.contentWindow?.jQuery,nativeOptions=pageJQ?.data(template,'ui-droppable')?.options;
      const addCell=row=>{const cell=row.insertCell();cell.className=template.className;if(nativeOptions&&pageJQ?.fn?.droppable)pageJQ(cell).droppable({...nativeOptions});return cell;};
      while(table.rows.length<rows){const row=table.insertRow();for(let c=0;c<Math.max(cols,table.rows[0].cells.length);c++)addCell(row);}
      for(const row of [...table.rows])while(row.cells.length<cols)addCell(row);
      for(const s of assignments){const card=cards.get(s.student);table.rows[s.row].cells[s.col].append(card);card.style.left='';card.style.top='';}
      context.field.value=ordered(assignments).map(s=>`${s.student},${s.col+1},${s.row+1};`).join('');
    }
    async function submitNative(context){
      await new Promise(resolve=>{const timer=setTimeout(resolve,15000);context.frame.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});context.submitter.click();});
    }
    async function saveGroups(){
      if(saving){status('Tallennus on jo käynnissä.');return;}
      saving=true;rosterDialog?.close();board.inert=true;panel.inert=true;saveWorking();
      const contexts=[],completed=[];
      try{
        const desired=new Map(snapshot().map(s=>[s.student,s]));
        // Preflight every source before sending the first POST.
        for(const source of sources.values()){
          status(`Valmistellaan opetusryhmää ${source.label||'Opetusryhmä'}…`);const context=await nativeGroupFrame(source.id);contexts.push(context);
          const assignments=context.records.map(record=>{const target=desired.get(record.student);return {student:record.student,row:target?.row??record.row,col:target?.col??record.col};});
          if(new Set(assignments.map(coord)).size!==assignments.length)throw Error(`Opetusryhmässä ${source.label||'Opetusryhmä'} näkyvän ja näkymästä poistetun opiskelijan paikat menevät päällekkäin. Palauta opiskelija näkymään tai muuta paikkoja ennen tallennusta.`);
          context.source=source;context.assignments=assignments;prepareNativeSave(context,assignments);
        }
        for(const context of contexts){
          const label=context.source.label||context.source.id;status(`Tallennetaan opetusryhmää ${label}…`);await submitNative(context);
          let verified=null;
          for(let attempt=0;attempt<3;attempt++){
            const records=await readGroup(context.source.id),actual=new Map(records.map(s=>[s.student,s]));
            if(context.assignments.every(s=>actual.has(s.student)&&coord(actual.get(s.student))===coord(s))){verified=records;break;}await new Promise(resolve=>setTimeout(resolve,500));
          }
          if(!verified)throw Error(`Opetusryhmän ${label} tallennusta ei voitu varmistaa lukemalla sivu uudelleen.`);
          context.source.students=verified;completed.push(label);context.frame.remove();
        }
        dirty=false;saveWorking();status(`Tallennettu Wilmaan ja tarkistettu: ${completed.join(', ')}.`);
      }catch(e){status(`${e.message}${completed.length?` Jo tallennettu Wilmaan: ${completed.join(', ')}.`:' Yhtään tallennusta ei ole vahvistettu.'}`);}
      finally{for(const context of contexts)context.frame.remove();saving=false;board.inert=false;panel.inert=false;updateSaveMode();}
    }
    function saveTags(){GM_setValue(TAGS_KEY,JSON.stringify(studentTags));}
    function renderTags(){
      for(const card of cards){
        const student=getStudent(card),tag=studentTags[student]||{},text=[cleanGroupLabel(tag.teachingGroup)||sourceNames(student),tag.note].filter(Boolean).join(' · ');
        let marker=card.querySelector('.wsp-student-tag');
        if(text&&!marker){marker=document.createElement('small');marker.className='wsp-student-tag';card.append(marker);}
        if(marker){marker.textContent=text;marker.title=text;marker.hidden=tagsHidden||tag.hidden===true||!text;marker.style.setProperty('display',marker.hidden?'none':'block','important');}
      }
      for(const button of shell.querySelectorAll('[data-action=tags]')){button.textContent=tagsHidden?'Näytä tunnisteet':'Piilota tunnisteet';button.setAttribute('aria-pressed',String(tagsHidden));}
      if(rosterDialog?.open){const checkbox=rosterDialog.querySelector('[data-global-tags]');if(checkbox)checkbox.checked=!tagsHidden;}
    }
    function openRoster(){
      rosterDialog?.remove();rosterDialog=document.createElement('dialog');rosterDialog.id='wsp-roster';
      const bar=document.createElement('div');bar.className='wsp-dialog-bar';
      const heading=document.createElement('h3');heading.textContent='Oppilaslista ja tunnisteet';
      const close=document.createElement('button');close.type='button';close.textContent='Sulje';close.addEventListener('click',()=>rosterDialog.close());bar.append(heading,close);rosterDialog.append(bar);
      const visibility=document.createElement('label'),global=document.createElement('input');global.type='checkbox';global.dataset.globalTags='1';global.checked=!tagsHidden;
      global.addEventListener('change',()=>{tagsHidden=!global.checked;GM_setValue(KEY+':tagsHidden',tagsHidden);renderTags();});visibility.append(global,document.createTextNode(' Näytä tunnisteet istumajärjestyksessä'));rosterDialog.append(visibility);
      const help=document.createElement('p');help.className='wsp-dialog-help';help.textContent='Opetusryhmän tunnus ja lisätunniste näkyvät pienellä oppilaan nimen alla. Opiskelijan poistaminen koskee vain tätä istumajärjestystä. Muutokset tallentuvat automaattisesti. Näytä-valinta koskee yksittäisen oppilaan tunnisteita.';rosterDialog.append(help);
      buildSourceControls(rosterDialog);
      const list=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr');
      for(const title of ['Oppilas','Opetusryhmä','Lisätunniste','Näytä','Poista']){const th=document.createElement('th');th.textContent=title;header.append(th);}head.append(header);list.append(head);
      const body=document.createElement('tbody');
      for(const seat of snapshot()){
        const student=seat.student,card=byId.get(student),tag=studentTags[student]||{},row=document.createElement('tr'),name=document.createElement('td');
        name.textContent=card.querySelector('p')?.textContent?.trim()||'Oppilas';row.append(name);
        for(const [key,caption,max] of [['teachingGroup','Opetusryhmän tunnus',60],['note','Lisätunniste',100]]){
          const cell=document.createElement('td'),input=document.createElement('input');input.type='text';input.maxLength=max;input.value=tag[key]||(key==='teachingGroup'?sourceNames(student):'');input.setAttribute('aria-label',caption);
          input.addEventListener('input',()=>{studentTags[student]={...(studentTags[student]||{}),[key]:input.value};saveTags();renderTags();});cell.append(input);row.append(cell);
        }
        const cell=document.createElement('td'),visible=document.createElement('input');visible.type='checkbox';visible.checked=!tag.hidden;visible.setAttribute('aria-label','Näytä oppilaan tunnisteet');
        visible.addEventListener('change',()=>{studentTags[student]={...(studentTags[student]||{}),hidden:!visible.checked};saveTags();renderTags();});cell.append(visible);row.append(cell);const removal=document.createElement('td'),remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Poista tästä istumajärjestyksestä';remove.addEventListener('click',()=>run(()=>{removeStudent(student);openRoster();}));removal.append(remove);row.append(removal);body.append(row);
      }
      list.append(body);rosterDialog.append(list);document.body.append(rosterDialog);rosterDialog.showModal();
    }
    function paint(){fitGrid();saveWorking();renderTags();renderSourceVisibility();updateSaveMode();updateEditor();const button=panel.querySelector('[data-action=photos]');button.textContent=photosHidden?'Näytä kuvat':'Piilota kuvat';button.setAttribute('aria-pressed',String(photosHidden));for(const card of cards)card.classList.toggle('wsp-locked',locks.has(getStudent(card)));}
    let resizeFrame,edgeFrame,dragging=false,fitPending=false,lastWidth=surface.clientWidth;
    const scheduleFit=()=>{if(dragging){fitPending=true;return;}cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(fitGrid);};
    window.addEventListener('resize',scheduleFit);
    surface.addEventListener('scroll',()=>{if(dragging)return;cancelAnimationFrame(edgeFrame);edgeFrame=requestAnimationFrame(drawEdges);},{passive:true});
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>{const width=surface.clientWidth;if(Math.abs(width-lastWidth)<1)return;lastWidth=width;scheduleFit();}).observe(surface);
    if(jq?.fn?.on)jq(table).on('dragstart.wspPerformance',()=>{dragging=true;}).on('dragstop.wspPerformance',()=>{dragging=false;if(fitPending){fitPending=false;scheduleFit();}else{cancelAnimationFrame(edgeFrame);edgeFrame=requestAnimationFrame(drawEdges);}});

    function apply(assignments,nextSeats=seats,record=true,desiredGrid=null){
      if(!Array.isArray(assignments)||assignments.length!==cards.length||new Set(assignments.map(s=>s.student)).size!==cards.length||assignments.some(s=>!byId.has(s.student)||!validSeat(s))||new Set(assignments.map(coord)).size!==cards.length)throw Error('Järjestys ei vastaa tämän ryhmän oppilaita.');
      if(!Array.isArray(nextSeats)||!nextSeats.every(validSeat)||new Set(nextSeats.map(coord)).size!==nextSeats.length||assignments.some(s=>!nextSeats.some(t=>coord(t)===coord(s))))throw Error('Oppilaspaikkaa ei löydy pöytäjärjestyksestä.');
      if(assignments.some(s=>nextSeats.some(t=>t.emptyLocked&&coord(t)===coord(s))))throw Error('Järjestys sijoittaisi oppilaan tyhjäksi lukittuun paikkaan. Vapauta kyseinen tyhjä lukitus ensin.');
      const current=snapshot();if(record){last=current;remember();}applying=true;
      ensureGrid({rows:Math.max(gridSize().rows,desiredGrid?.rows||0,...nextSeats.map(s=>s.row+1)),cols:Math.max(gridSize().cols,desiredGrid?.cols||0,...nextSeats.map(s=>s.col+1))});
      for(const seat of assignments){const card=byId.get(seat.student);cellAt(seat).append(card);card.style.left='';card.style.top='';}
      seats=clone(nextSeats);last=sync();applying=false;paint();status('Järjestys muutettu. Tallenna oppilassijoittelu myös Wilman Tallenna-painikkeella.');
    }
    function useLayout(entry){
      if(locks.size)throw Error('Vapauta oppilaiden lukitukset ennen pöytäjärjestyksen vaihtamista.');
      const originalCount=layoutSeats(entry).length;entry=completeLayout(entry,cards.length);
      const added=entry.seats.length-originalCount;
      if(added)$('editorTotal').value=String(Math.max(presetCount(),entry.seats.length));
      const nextSeats=layoutSeats(entry),available=ordered(nextSeats.filter(s=>!s.emptyLocked));
      if(available.length<cards.length)throw Error('Pöytäjärjestyksessä on liian vähän arvottavia paikkoja oppilaille.');
      apply(snapshot().map((s,i)=>({...available[i],student:s.student})),nextSeats,true,entry.grid);
      if(entry.grid){trimGrid(entry.grid);paint();}if($('layouts').querySelector(`option[value="${entry.id}"]`))$('layouts').value=entry.id;if(added)refresh();status(`Pöytäjärjestys ”${entry.name}” käytössä.${added?` Lisätty automaattisesti ${added} puuttuvaa paikkaa.`:''} Tallenna oppilassijoittelu myös Wilmaan.`);
    }
    function shuffled(items){
      const result=[...items];for(let i=result.length-1;i>0;i--){const range=i+1,limit=Math.floor(4294967296/range)*range,n=new Uint32Array(1);do{crypto.getRandomValues(n);}while(n[0]>=limit);const j=n[0]%range;[result[i],result[j]]=[result[j],result[i]];}return result;
    }
    function randomize(){
      const current=snapshot(),pinned=current.filter(s=>locks.has(s.student)),pinnedPlaces=new Set(pinned.map(coord));
      if(pinned.some(s=>!seats.some(t=>!t.emptyLocked&&coord(t)===coord(s))))throw Error('Lukitun oppilaan paikka ei ole käytettävissä. Vapauta lukitus.');
      const occupied=new Set(current.map(coord));
      const movable=current.filter(s=>!locks.has(s.student)),available=seats.filter(s=>!s.emptyLocked&&!pinnedPlaces.has(coord(s))&&(drawMode!=='current'||occupied.has(coord(s))));
      if(available.length<movable.length)throw Error('Arvottavia paikkoja on liian vähän. Lisää paikkoja tai vapauta tyhjiä lukituksia.');
      const places=(fillEnabled?orderFillSeats(available,fillDirection):drawMode==='all'||drawMode==='current'?shuffled(available):[...shuffled(available.filter(s=>!occupied.has(coord(s)))),...shuffled(available.filter(s=>occupied.has(coord(s))))]).slice(0,movable.length),students=shuffled(movable.map(s=>s.student));
      const previous=new Map(current.map(s=>[s.student,coord(s)])),owner=new Map();
      function place(student,seen){for(let i=0;i<places.length;i++){if(seen.has(i)||coord(places[i])===previous.get(student))continue;seen.add(i);if(!owner.has(i)||place(owner.get(i),seen)){owner.set(i,student);return true;}}return false;}
      const matched=students.every(student=>place(student,new Set()));
      apply([...pinned,...places.map((s,i)=>({...s,student:matched?owner.get(i):students[i]}))]);
    }
    async function copyList(){
      const names=snapshot().filter(s=>{const card=byId.get(s.student);return !card.classList.contains('wsp-source-hidden');}).map(s=>byId.get(s.student).querySelector('p')?.textContent?.trim().replace(/\s+/g,' '));
      if(names.some(name=>!name))throw Error('Opiskelijan nimeä ei löydy kortista.');
      const text=names.join('\n');if(typeof GM_setClipboard==='function')GM_setClipboard(text,'text');else await navigator.clipboard.writeText(text);
      status(`Oppilaslista kopioitu: ${names.length} opiskelijaa.`);
    }
    async function copyTables(){
      const occupants=new Map(snapshot().map(s=>[coord(s),s.student]));
      const sections=tableGroups().map(members=>{
        const names=members.flatMap(s=>{const student=occupants.get(coord(s));if(!student)return [];const name=byId.get(student).querySelector('p')?.textContent?.trim().replace(/\s+/g,' ');if(!name)throw Error('Oppilaan nimeä ei löydy kortista.');return [name];});
        return `Pöytäryhmä ${members.number} (${names.length} oppilasta / ${members.length} paikkaa)\n${names.length?names.map(name=>`- ${name}`).join('\n'):'(ei oppilaita)'}`;
      });
      const text=sections.join('\n\n');if(typeof GM_setClipboard==='function')GM_setClipboard(text,'text');else await navigator.clipboard.writeText(text);status(`Nimet kopioitu: ${sections.length} pöytäryhmää.`);
    }
    function store(kind,replace){
      const previous=replace?chosen(kind):null;if(previous?.builtin)throw Error('Tallenna valmis pohja uutena omalla nimellä.');
      const name=prompt('Tallenteen nimi:',previous?.name||'');if(name===null)return;if(!validName(name))throw Error('Anna nimi (1–100 merkkiä).');
      const entry={id:previous?.id||id(),name:name.trim(),grid:gridSize()};
      if(kind==='layouts')entry.seats=clone(seats);else{entry.group=group;entry.assignments=snapshot();entry.tags=clone(studentTags);entry.roster=isCombined()?rosterState():null;}
      const next=clone(db);next[kind]=next[kind].filter(item=>item.id!==entry.id);next[kind].push(entry);saveDB(next);refresh();$(kind).value=entry.id;status('Tallenne tallennettu.');
    }
    function rename(kind){const entry=chosen(kind);if(entry.builtin)throw Error('Tallenna valmis pohja ensin uutena.');const name=prompt('Uusi nimi:',entry.name);if(name===null)return;if(!validName(name))throw Error('Anna nimi (1–100 merkkiä).');const next=clone(db);next[kind].find(item=>item.id===entry.id).name=name.trim();saveDB(next);refresh();}
    function remove(kind){const entry=chosen(kind);if(entry.builtin)throw Error('Valmista pohjaa ei voi poistaa.');if(!confirm(`Poistetaanko tallenne ”${entry.name}”?`))return;const next=clone(db);next[kind]=next[kind].filter(item=>item.id!==entry.id);saveDB(next);refresh();}
    function exportJSON(all){const data={version:1,layouts:clone(db.layouts),arrangements:all?clone(db.arrangements):[]},url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=all?'wilma-seating-all.json':'wilma-desk-layouts.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function syncEditorMinimum(commit=false){
      const input=$('editorTotal'),minimum=Math.max(1,cards.length);input.min=String(minimum);
      const value=Number(input.value);
      if((commit||document.activeElement!==input)&&(!Number.isInteger(value)||value<minimum))input.value=String(minimum);
      return minimum;
    }
    function editorConfig(){const minimum=syncEditorMinimum();return {groups:Number($('editorGroups').value),across:Number($('editorAcross').value),rows:Number($('editorRows').value),cols:Number($('editorCols').value),total:Math.max(minimum,Number($('editorTotal').value))};}

    let editorRenderKey='';
    function updateEditor(){
      const key=JSON.stringify([editorConfig(),cards.length]);if(key===editorRenderKey)return;editorRenderKey=key;
      const button=panel.querySelector('[data-action=applyEditor]'),preview=$('editorPreview');preview.replaceChildren();
      try{
        const config=editorConfig(),entry=makeEditorLayout(config),usable=entry.seats.length;
        $('editorSummary').textContent=`${config.groups} pöytäryhmää · ${entry.seats.length} paikkaa · ruudukko ${entry.grid.rows} × ${entry.grid.cols}. ${config.total>config.groups*config.rows*config.cols?'Tarvittavat lisärivit luodaan automaattisesti.':''}`;
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${entry.grid.cols*10} ${entry.grid.rows*10}`);svg.setAttribute('width','100%');svg.setAttribute('height','130');svg.setAttribute('aria-hidden','true');svg.style.background='white';
        entry.seats.forEach((seat,i)=>{const rect=document.createElementNS(svg.namespaceURI,'rect');rect.setAttribute('x',String(seat.col*10));rect.setAttribute('y',String(seat.row*10));rect.setAttribute('width','9');rect.setAttribute('height','9');rect.setAttribute('fill','#cbd5e1');rect.setAttribute('stroke','#94a3b8');rect.setAttribute('stroke-width','.4');svg.append(rect);});preview.append(svg);
        panel.querySelector('[data-action=saveEditor]').disabled=false;
        button.disabled=false;button.title=usable<cards.length?'Puuttuvat opiskelijapaikat lisätään automaattisesti käyttöönotossa.':'';
        GM_setValue(`${KEY}:editor`,JSON.stringify(config));
      }catch(e){$('editorSummary').textContent=e.message;button.disabled=true;panel.querySelector('[data-action=saveEditor]').disabled=true;}
    }
    try{const config=JSON.parse(GM_getValue(`${KEY}:editor`,'null'));if(config)for(const [key,role] of [['groups','editorGroups'],['across','editorAcross'],['rows','editorRows'],['cols','editorCols'],['total','editorTotal']])if(Number.isInteger(config[key]))$(role).value=String(config[key]);}catch{}
    for(const role of ['editorGroups','editorAcross','editorRows','editorCols','editorTotal'])$(role).addEventListener('input',()=>{updateEditor();if(role==='editorTotal')refresh();});
    $('editorTotal').addEventListener('change',()=>{syncEditorMinimum(true);updateEditor();refresh();});
    function saveEditor(){
      const entry=makeEditorLayout(editorConfig()),name=$('editorName').value.trim()||entry.name;
      if(!validName(name))throw Error('Anna pohjalle nimi (1–100 merkkiä).');
      const next=clone(db),saved={id:id(),name,seats:entry.seats,grid:entry.grid};next.layouts.push(saved);saveDB(next);refresh();$('layouts').value=saved.id;status(`Pohja ”${name}” tallennettu. Ota se käyttöön valitsemalla Ota käyttöön.`);
    }
    const actions={
      saveEditor,copyList,
      applyEditor:()=>{useLayout(makeEditorLayout(editorConfig()));$('layouts').value='';updateEditor();},
      loadLayout:()=>useLayout(chosen('layouts')),saveLayout:()=>store('layouts',false),updateLayout:()=>store('layouts',true),renameLayout:()=>rename('layouts'),deleteLayout:()=>remove('layouts'),
      loadArrangement:()=>{const entry=chosen('arrangements');if(locks.size)throw Error('Vapauta oppilaiden lukitukset ennen palautusta.');if(entry.roster){const merged=new Map(seats.map(s=>[coord(s),s]));for(const {row,col} of entry.assignments)if(!merged.has(coord({row,col})))merged.set(coord({row,col}),{row,col});installRoster(entry.roster,entry.assignments,[...merged.values()],entry.grid);if(entry.tags){studentTags=cleanTags({...studentTags,...entry.tags});saveTags();renderTags();}return;}if(isCombined()){const wanted=new Set(entry.assignments.map(s=>s.student)),merged=new Map(seats.map(s=>[coord(s),s]));for(const {row,col} of entry.assignments)if(!merged.has(coord({row,col})))merged.set(coord({row,col}),{row,col});installRoster({sources:[{id:group,label:sources.get(group)?.label||'',students:clone(nativeRecords)}],active:[...nativeById.keys()].filter(id=>wanted.has(id))},entry.assignments,[...merged.values()],entry.grid);if(entry.tags){studentTags=cleanTags({...studentTags,...entry.tags});saveTags();renderTags();}return;}if(locks.size)throw Error('Vapauta oppilaiden lukitukset ennen palautusta.');const merged=new Map(seats.map(s=>[coord(s),s]));for(const {row,col} of entry.assignments)if(!merged.has(coord({row,col})))merged.set(coord({row,col}),{row,col});apply(entry.assignments,[...merged.values()],true,entry.grid);if(entry.tags){studentTags=cleanTags({...studentTags,...entry.tags});saveTags();renderTags();}},
      saveArrangement:()=>store('arrangements',false),updateArrangement:()=>store('arrangements',true),renameArrangement:()=>rename('arrangements'),deleteArrangement:()=>remove('arrangements'),
      saveGroups:saveGroups,roster:openRoster,tags:()=>{tagsHidden=!tagsHidden;GM_setValue(KEY+':tagsHidden',tagsHidden);renderTags();},
      shuffle:randomize,photos:()=>{photosHidden=!photosHidden;GM_setValue(KEY+':photosHidden',photosHidden);paint();},copyTables,
      undo:()=>{const previous=undo[undo.length-1];if(!previous)throw Error('Ei kumottavaa muutosta.');apply(previous.assignments,previous.seats,false,previous.grid);trimGrid(previous.grid);locks.clear();for(const student of previous.locks||[])if(byId.has(student))locks.add(student);undo.pop();paint();},
      unlock:()=>{last=snapshot();remember();locks.clear();seats=seats.map(s=>({...s,emptyLocked:false}));paint();status('Oppilaiden ja tyhjien paikkojen lukitukset poistettu.');},
      exportLayouts:()=>exportJSON(false),exportAll:()=>{if(confirm('Vienti sisältää tallennettujen ryhmien opiskelijatietoja, kuten nimiä ja tunnisteita. Jatketaanko?'))exportJSON(true);},import:()=>$('file').click()
    };
    shell.querySelectorAll('#wsp-panel button,.wsp-board-actions button').forEach(button=>button.type='button');
    shell.addEventListener('click',event=>{
      if(!panel.contains(event.target)&&!boardTools.contains(event.target))return;
      const tab=event.target.closest('[data-tab]');if(tab){for(const button of panel.querySelectorAll('[data-tab]'))button.setAttribute('aria-selected',String(button===tab));for(const pane of panel.querySelectorAll('[data-pane]'))pane.hidden=pane.dataset.pane!==tab.dataset.tab;return;}
      const button=event.target.closest('button[data-action]');if(!button)return;event.preventDefault();run(actions[button.dataset.action]);
    });
    $('file').addEventListener('change',async()=>{
      const file=$('file').files[0];if(!file)return;
      try{if(file.size>5000000)throw Error('Tiedoston enimmäiskoko on 5 Mt.');const incoming=validate(JSON.parse(await file.text())),next=clone(db);for(const kind of ['layouts','arrangements'])for(const item of incoming[kind])next[kind].push({...item,id:id()});saveDB(next);refresh();status('Tallenteet tuotu uusina kopioina.');}catch(e){status(`Tuonti epäonnistui: ${e.message}`);}finally{$('file').value='';}
    });
    orderMenu?.addEventListener('change',event=>{
      if(!orderMenu.value.startsWith('wsp:'))return;event.stopImmediatePropagation();const selected=orderMenu.value.slice(4);orderMenu.selectedIndex=0;run(()=>{const entry=selected.startsWith('builtin-')?makePreset(selected.slice(8),presetCount()):db.layouts.find(item=>item.id===selected);if(entry)useLayout(entry);});
    },true);
    table.addEventListener('mousedown',event=>{
      if(event.altKey||event.target.closest('input,button,.wsp-group-badge'))event.stopImmediatePropagation();
      else if(event.target.closest('.ui-draggable:not(.wsp-empty-card)'))nativeDragStart={assignments:clone(snapshot()),seats:clone(seats),grid:gridSize(),locks:[...locks]};
    },true);
    table.addEventListener('click',event=>{
      const cell=event.target.closest('td,th');if(!cell||cell.closest('table')!==table)return;
      const card=event.target.closest('.ui-draggable:not(.wsp-empty-card)'),seat=seatAt(cell);
      if(event.altKey&&(card||seat)){
        event.preventDefault();event.stopImmediatePropagation();last=snapshot();remember();
        if(card){const student=getStudent(card);locks.has(student)?locks.delete(student):locks.add(student);status('Oppilaan paikkalukitus vaihdettu.');}
        else{seat.emptyLocked=!seat.emptyLocked;status(seat.emptyLocked?'Pöytä lukittu tyhjäksi. Oppilaita ei arvota tähän paikkaan.':'Tyhjä lukitus vapautettu.');}
        paint();return;
      }
      const add=event.target.closest('.wsp-add-seat');if(add){event.preventDefault();event.stopImmediatePropagation();run(()=>addEmpty(cell));return;}
      const remove=event.target.closest('.wsp-remove-seat');if(remove){event.preventDefault();event.stopImmediatePropagation();run(()=>{if(isOccupied(cell))throw Error('Varattua paikkaa ei voi poistaa.');last=snapshot();remember();const key=coord(point(cell));seats=seats.filter(s=>coord(s)!==key);paint();status('Pöytä poistettu ja muutos tallennettu.');});return;}
      const reset=event.target.closest('.wsp-group-reset');if(reset&&seat){event.preventDefault();event.stopImmediatePropagation();last=snapshot();remember();delete seat.group;paint();status('Pöytä palautettu automaattiseen pöytäryhmään.');return;}
      if(event.target.closest('input,.wsp-group-badge'))event.stopImmediatePropagation();
    },true);
    table.addEventListener('change',event=>{
      const input=event.target;if(!input.matches('.wsp-seat-label,.wsp-group-number'))return;
      event.stopImmediatePropagation();run(()=>{
        const cell=input.closest('td,th'),seat=seatAt(cell);if(!seat)return;
        if(input.matches('.wsp-group-number')){const number=Number(input.value);if(!Number.isInteger(number)||number<1||number>999){paint();throw Error('Ryhmänumeron tulee olla 1–999.');}last=snapshot();remember();seat.group=number;}
        else{const label=input.value.trim().replace(/\s+/g,' ')||'tyhjä';if(!validName(label)){paint();throw Error('Pöydän nimi saa olla enintään 100 merkkiä.');}last=snapshot();remember();if(label==='tyhjä')delete seat.label;else seat.label=label;}
        paint();status('Pöydän muutos tallennettu automaattisesti.');
      });
    });
    table.addEventListener('keydown',event=>{
      const input=event.target;if(!input.matches('.wsp-seat-label,.wsp-group-number'))return;
      event.stopImmediatePropagation();if(event.key==='Enter'){event.preventDefault();input.blur();}
      if(event.key==='Escape'){event.preventDefault();const seat=seatAt(input.closest('td,th'));input.value=input.matches('.wsp-seat-label')?(seat?.label||'tyhjä'):String(tableGroups().find(members=>members.some(s=>s===seat))?.number||1);input.blur();}
    });
    let observationTimer;
    new MutationObserver(records=>{
      if(applying||!records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>cards.includes(node))))return;clearTimeout(observationTimer);observationTimer=setTimeout(()=>run(()=>{
        const current=snapshot();if(JSON.stringify(current)===JSON.stringify(last))return;
        if(nativeDragStart){undo.push(nativeDragStart);if(undo.length>30)undo.shift();nativeDragStart=null;}else remember();
        for(const old of last)if(!current.some(s=>s.student===old.student&&coord(s)===coord(old)))locks.delete(old.student);
        for(const s of current)if(!seats.some(t=>coord(t)===coord(s)))seats.push({row:s.row,col:s.col});
        padEdges();last=sync();paint();status('Siirto havaittu. Tallenna oppilassijoittelu Wilman Tallenna-painikkeella.');
      }),0);
    }).observe(table,{childList:true,subtree:true});
    const nativeForm=field.form;
    nativeForm?.addEventListener('submit',event=>{if(isCombined()){event.preventDefault();event.stopImmediatePropagation();run(saveGroups);return;}saveWorking();if(dirty)sync();},true);
    nativeForm?.addEventListener('click',event=>{const button=event.target.closest('input[type=submit],button');if(!isCombined()||!button||button.form!==nativeForm||button.type!=='submit')return;event.preventDefault();event.stopImmediatePropagation();run(saveGroups);},true);
    if(nativeForm&&typeof nativeForm.submit==='function'){const submit=nativeForm.submit.bind(nativeForm);nativeForm.submit=()=>isCombined()?run(saveGroups):submit();}

    field.form?.addEventListener('submit',()=>{dirty=false;});
    window.addEventListener('beforeunload',event=>{saveWorking();if(dirty){event.preventDefault();event.returnValue='';}});
    let restored=false,restoreError=false;restoringShared=true;try{restored=restoreWorking();}catch{restoreError=true;}finally{restoringShared=false;}
    window.addEventListener('focus',()=>{if(saving)return;const id=GM_getValue(`${KEY}:combined-link:${group}`,null);if(id){restoringShared=true;try{restoreWorking();}catch(e){status(e.message);}finally{restoringShared=false;}paint();}else if(sharedId){sharedId=null;installRoster({sources:[{id:group,label:groupName(document,group),students:clone(nativeRecords)}],active:[...nativeById.keys()]},nativeRecords,seats,gridSize(),false,true);status('Ryhmien yhdistäminen poistettiin toisessa näkymässä.');}});
    refresh();paint();const conflict=snapshot().some(s=>seats.some(t=>t.emptyLocked&&coord(t)===coord(s)));
    status(conflict?'Tyhjäksi lukitun pöydän kohdalla on Wilmaan tallennettu oppilas. Siirrä tai arvo oppilas muualle tai vapauta tyhjä lukitus.':restoreError?'Automaattista tallennetta ei voitu palauttaa. Nimetyt pöytäjärjestykset ovat käytettävissä.':restored?'Pöydät, nimet, ryhmät ja tyhjät lukitukset palautettu.':'Valmis. Muokkaa pöytien nimiä ja ryhmänumeroita suoraan ruudukossa.');
  }
})();
