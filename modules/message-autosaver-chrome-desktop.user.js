// ==UserScript==
// @name         WilmaTools - Message Autosaver (Chrome Desktop)
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.15.3
// @description  Chrome desktop local Wilma compose autosave: subject, body and recipients.
// @match        https://*.inschool.fi/messages/compose*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    // Only activate the intended browser variant, avoiding two simultaneous autosavers.
    const ua = navigator.userAgent;
    if ( /Android|iPhone|iPad|iPod/i.test(ua) || !/Chrome|Chromium/i.test(ua) || /Edg\//i.test(ua)) return;

    // Drafts are sensitive: stored only on this origin in localStorage; clear after sending.
    const STORAGE_KEY = 'wilma-compose-autosave:' + location.hostname + location.pathname;
    const HISTORY_KEY='wilmatools.draftHistory.v1', TEMPLATE_KEY='wilmatools.messageTemplates.v1', REQUEST_KEY='wilmatools.composeRequest.v1';

    const SEL = {
        subject: 'input#wff-Subject',
        bodyTextarea: 'textarea#wff-BodyText',
        recipientsCell: 'div#messages-recipients-cell',
        recipientsOpen: 'button#recipients-open',
        recipientsSearchInput: 'input#recipients-search-input',
        recipientsSearchResults: 'div#recipients-search-results',

        recipientButtons: [
            'button.recipient-block',
            'button.student-block',
            'button.guardian-block',
            'button.teacher-block',
            'button.personnel-block',
            'button.recipient-block.student-block.margin-right',
            'div#recipients-search-results button.recipient-block',
            'div#recipients-search-results button.student-block',
            'div#recipients-search-results button.guardian-block'
        ].join(','),

        sendButton: 'input[name="addsavebtn"]',
        draftButton: 'input[name="draftbtn"]',
        cancelButton: 'input[name="cancelbtn"]'
    };

    let initialized = false;
    let saveTimer = null;
    let lastSavedJson = '';

    function $(selector, root = document) {
        return root.querySelector(selector);
    }

    function $all(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    function ensureUi() {
        if (!document.documentElement) return;

        if (!$('#wilma-as-style')) {
            const style = document.createElement('style');
            style.id = 'wilma-as-style';
            style.textContent = `
                #wilma-as-indicator {
                    position: fixed !important;
                    left: auto !important;
                    right: 14px !important;
                    top: 14px !important;
                    max-width: min(420px, calc(100vw - 28px)) !important;
                    z-index: 2147483647 !important;
                    background: #7a4b00 !important;
                    color: #fff !important;
                    padding: 8px 10px !important;
                    border-radius: 8px !important;
                    font: 13px/1.3 sans-serif !important;
                    box-shadow: 0 2px 10px rgba(0,0,0,.4) !important;
                    pointer-events: auto !important;
                }

                #wilma-as-indicator.ok {
                    background: #155724 !important;
                }

                #wilma-as-indicator.error {
                    background: #721c24 !important;
                }

                #wilma-as-panel {
                    position: fixed !important;
                    left: auto !important;
                    right: 14px !important;
                    bottom: 14px !important;
                    width: min(440px, calc(100vw - 28px)) !important;
                    z-index: 2147483646 !important;
                    background: rgba(0,0,0,.88) !important;
                    color: white !important;
                    padding: 8px !important;
                    border-radius: 8px !important;
                    font: 13px sans-serif !important;
                    box-shadow: 0 2px 10px rgba(0,0,0,.4) !important;
                }

                #wilma-as-panel button {
                    font-size: 13px !important;
                    margin: 3px !important;
                    padding: 6px 8px !important;
                }
            `;
            document.documentElement.appendChild(style);
        }

        if (!$('#wilma-as-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'wilma-as-indicator';
            indicator.textContent = 'Wilma Autosaver: script injected, waiting...';
            document.documentElement.appendChild(indicator);
        }
    }

    function setIndicator(text, state) {
        ensureUi();

        const el = $('#wilma-as-indicator');
        if (!el) return;

        el.classList.remove('ok', 'error');
        if (state) el.classList.add(state);

        el.textContent = text;
        el.style.display='none';
    }

    function createPanel() {
        ensureUi();

        if ($('#wilma-as-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'wilma-as-panel';
        panel.innerHTML = `
            <div><strong>Wilma Autosaver</strong></div>
            <div id="wilma-as-info">No saved draft checked yet.</div>
            <button type="button" id="wilma-as-save">Save now</button>
            <button type="button" id="wilma-as-restore">Restore</button>
            <button type="button" id="wilma-as-refresh-recipients">Refresh recipients</button>
            <button type="button" id="wilma-as-clear">Clear</button>
            <button type="button" id="wilma-as-hide">Hide</button>
        `;

        document.documentElement.appendChild(panel);

        $('#wilma-as-save').addEventListener('click', () => saveDraft('manual'));

        $('#wilma-as-restore').addEventListener('click', async () => {
            await restoreSavedDraft(true);
        });

        $('#wilma-as-refresh-recipients').addEventListener('click', async () => {
            const draft = loadDraft();

            if (!draft || !draft.recipients) {
                setIndicator('Wilma Autosaver: no saved recipients to refresh', 'error');
                return;
            }

            await restoreRecipients(draft.recipients);
        });

        $('#wilma-as-clear').addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEY);
            lastSavedJson = '';
            setIndicator('Wilma Autosaver: saved draft cleared', 'ok');
            updateInfo();
        });

        $('#wilma-as-hide').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        panel.style.display = 'none';
        updateInfo();
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return tmp.textContent || tmp.innerText || '';
    }

    function normalizeText(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function dispatchBasicEvents(el) {
        if (!el) return;

        ['input', 'change', 'click', 'keyup', 'keydown', 'blur', 'focusout'].forEach(type => {
            try {
                el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
            } catch (err) {
                console.warn('[Wilma Autosaver] Event failed:', type, err);
            }
        });
    }

    function getCkeditorInstance() {
        try {
            if (!window.CKEDITOR || !window.CKEDITOR.instances) return null;

            if (window.CKEDITOR.instances['wff-BodyText']) {
                return window.CKEDITOR.instances['wff-BodyText'];
            }

            const textarea = $(SEL.bodyTextarea);
            if (!textarea) return null;

            return Object.values(window.CKEDITOR.instances).find(instance => {
                return instance.element && instance.element.$ === textarea;
            }) || null;
        } catch (err) {
            return null;
        }
    }

    function getCkeditorIframeDocument() {
        try {
            const textarea = $(SEL.bodyTextarea);
            if (!textarea) return null;

            const wrapper =
                $('#cke_wff-BodyText') ||
                textarea.closest('.form-group')?.querySelector('.cke');

            const iframe =
                wrapper?.querySelector('iframe') ||
                $('iframe.cke_wysiwyg_frame');

            if (!iframe) return null;

            return iframe.contentDocument || iframe.contentWindow.document;
        } catch (err) {
            return null;
        }
    }

    function getBodyHtml() {
        const editor = getCkeditorInstance();

        if (editor && typeof editor.getData === 'function') {
            const html = editor.getData() || '';
            if (html.trim()) return html;
        }

        const iframeDoc = getCkeditorIframeDocument();
        if (iframeDoc && iframeDoc.body) {
            const html = iframeDoc.body.innerHTML || '';
            if (html.trim()) return html;
        }

        const textarea = $(SEL.bodyTextarea);
        return textarea ? textarea.value || '' : '';
    }

    function setBodyHtml(html) {
      const raw=String(html||'');
      const value=/<[a-z][\s\S]*>/i.test(raw)?raw:raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r?\n/g,'<br>');
      const textarea=$(SEL.bodyTextarea);
      const token=Symbol('wilmatools-editor-write');
      setBodyHtml.pending=token;
      let tries=0;
      const attempt=()=>{
        if(setBodyHtml.pending!==token)return true;
        const editor=getCkeditorInstance();
        if(!editor||editor.status!=='ready'||typeof editor.setData!=='function')return false;
        try{
          // CKEditor 4 setData is asynchronous. Never mutate its iframe or source
          // textarea while setData runs: both can break the editor's editable state.
          editor.setData(value,{
            callback:function(){
              if(setBodyHtml.pending!==token)return;
              try{
                editor.updateElement();
                editor.fire('change');
                const actual=editor.getData();
                if(!actual.trim()&&value.trim())console.warn('[WilmaTools] Editor returned empty content after setData');
              }catch(e){console.warn('[WilmaTools] CKEditor post-load check:',e)}
              setBodyHtml.pending=null;
            },
            noSnapshot:false
          });
          return true;
        }catch(e){console.warn('[WilmaTools] CKEditor setData:',e);return false}
      };
      if(attempt())return;
      const wait=setInterval(()=>{
        if(setBodyHtml.pending!==token||attempt()){clearInterval(wait);return}
        if(++tries>=60){
          clearInterval(wait);
          const instance=getCkeditorInstance();
          console.warn('[WilmaTools] Editor diagnostic:',{hasCKEditor:!!window.CKEDITOR,instanceNames:Object.keys(window.CKEDITOR?.instances||{}),status:instance?.status||'missing',hasSetData:typeof instance?.setData==='function'});
          alert('Viestitekstin lataus epäonnistui. Avaa konsoli ja lähetä WilmaTools Editor diagnostic -tulos.');
        }
      },250);
    }

    function getRecipientButtonSignature(button) {
        return {
            text: normalizeText(button.innerText || button.textContent || ''),
            title: normalizeText(button.getAttribute('title') || ''),
            ariaLabel: normalizeText(button.getAttribute('aria-label') || ''),
            value: normalizeText(button.value || ''),
            name: normalizeText(button.getAttribute('name') || ''),
            className: normalizeText(button.className || '')
        };
    }

    function getRecipientsSnapshot() {
        const cell = $(SEL.recipientsCell);

        if (!cell) {
            return {
                html: '',
                text: '',
                inputs: [],
                visualItems: []
            };
        }

        const inputs = $all('input[type="hidden"]', cell).map(input => ({
            name: input.name || '',
            value: input.value || '',
            title: input.getAttribute('title') || ''
        }));

        const visualItems = $all('.recipient-item, span, button, input[type="hidden"]', cell).map(el => ({
            tag: el.tagName || '',
            text: (el.innerText || el.textContent || '').trim(),
            title: el.getAttribute('title') || '',
            name: el.getAttribute('name') || '',
            value: el.value || '',
            className: el.className || ''
        })).filter(item => {
            return item.text || item.title || item.name || item.value;
        });

        return {
            html: cell.innerHTML || '',
            text: (cell.innerText || cell.textContent || '').trim(),
            inputs,
            visualItems
        };
    }

    function recipientSnapshotTokens(snapshot) {
        const tokens = new Set();

        function add(value) {
            const normalized = normalizeText(value);
            if (normalized) tokens.add(normalized);
        }

        (snapshot.inputs || []).forEach(input => {
            add(input.name);
            add(input.value);
            add(input.title);
        });

        (snapshot.visualItems || []).forEach(item => {
            add(item.text);
            add(item.title);
            add(item.name);
            add(item.value);
        });

        add(snapshot.text);

        return tokens;
    }

    function buttonMatchesRecipientSnapshot(button, snapshot) {
        const tokens = recipientSnapshotTokens(snapshot);
        const sig = getRecipientButtonSignature(button);

        const haystack = [
            sig.text,
            sig.title,
            sig.ariaLabel,
            sig.value,
            sig.name,
            sig.className
        ].filter(Boolean);

        for (const h of haystack) {
            if (tokens.has(h)) return true;

            for (const t of tokens) {
                if (!t) continue;

                /*
                  Avoid matching overly generic values such as "r_student",
                  "student-block", "kaikki", etc.
                */
                if (t.length < 5) continue;
                if (['r_student', 'r_guardian', 'r_teacher', 'kaikki'].includes(t)) continue;

                if (h.includes(t) || t.includes(h)) {
                    return true;
                }
            }
        }

        return false;
    }

    async function openRecipientsPanel() {
        const openButton = $(SEL.recipientsOpen);

        if (!openButton) {
            setIndicator('Wilma Autosaver: recipients-open button not found', 'error');
            return false;
        }

        openButton.click();
        await sleep(900);
        return true;
    }

    function clickVisibleMatchingRecipientButtons(snapshot) {
        const buttons = $all(SEL.recipientButtons);
        let clicked = 0;

        for (const button of buttons) {
            if (!buttonMatchesRecipientSnapshot(button, snapshot)) continue;

            const beforeClass = button.className || '';

            try {
                button.click();
                clicked += 1;
                dispatchBasicEvents(button);

                console.log('[Wilma Autosaver] clicked matching recipient button', {
                    text: button.innerText || button.textContent || '',
                    title: button.getAttribute('title') || '',
                    beforeClass,
                    afterClass: button.className || ''
                });
            } catch (err) {
                console.warn('[Wilma Autosaver] could not click recipient button:', err);
            }
        }

        return clicked;
    }

    function getSearchTermsFromSnapshot(snapshot) {
        const terms = [];

        function addTerm(value) {
            const v = String(value || '').replace(/\s+/g, ' ').trim();
            if (!v) return;

            /*
              Skip technical values that are unlikely to work in the visible search box.
            */
            if (v.includes('=')) return;
            if (v.startsWith('r_')) return;
            if (v.length < 3) return;

            terms.push(v);
        }

        addTerm(snapshot.text);

        (snapshot.visualItems || []).forEach(item => {
            addTerm(item.text);
            addTerm(item.title);
        });

        /*
          Deduplicate and keep only a few. On strict privacy captures, visible
          names may not be available. In that case this list may be empty.
        */
        return Array.from(new Set(terms)).slice(0, 5);
    }

    async function searchAndClickRecipients(snapshot) {
        const searchInput = $(SEL.recipientsSearchInput);
        if (!searchInput) return 0;

        const terms = getSearchTermsFromSnapshot(snapshot);
        let totalClicked = 0;

        for (const term of terms) {
            searchInput.value = term;
            dispatchBasicEvents(searchInput);

            /*
              Some Wilma recipient search UIs react better to real-ish keyboard events.
            */
            try {
                searchInput.dispatchEvent(new KeyboardEvent('keyup', {
                    bubbles: true,
                    cancelable: true,
                    key: term.slice(-1) || 'a'
                }));
            } catch (err) {
                // Ignore.
            }

            await sleep(1000);

            const clicked = clickVisibleMatchingRecipientButtons(snapshot);
            totalClicked += clicked;

            if (clicked > 0) {
                await sleep(400);
            }
        }

        return totalClicked;
    }

    async function clickSummaryOrCloseButtons() {
        const buttons = Array.from(document.querySelectorAll(
            'button, input[type="button"], input[type="submit"], a[role="button"]'
        ));

        const preferred = buttons.filter(btn => {
            const text = normalizeText(
                btn.innerText ||
                btn.textContent ||
                btn.value ||
                btn.getAttribute('aria-label') ||
                btn.getAttribute('title') ||
                ''
            );

            return (
                text.includes('vastaanottajien yhteenveto') ||
                text.includes('yhteenveto') ||
                text.includes('valmis') ||
                text.includes('sulje') ||
                text === 'ok'
            );
        });

        let clicked = 0;

        for (const btn of preferred) {
            try {
                btn.click();
                clicked += 1;
                await sleep(250);
            } catch (err) {
                console.warn('[Wilma Autosaver] summary/close click failed:', err);
            }
        }

        return clicked;
    }

    async function restoreRecipients(snapshot) {
        if (!snapshot || (!snapshot.html && !(snapshot.inputs || []).length)) {
            setIndicator('Wilma Autosaver: no recipient snapshot to restore', 'error');
            return false;
        }

        await openRecipientsPanel();

        /*
          Step 1: try the proper Wilma route first — click matching visible recipient buttons.
          This is what should update Wilma's own visual/React state.
        */
        let clicked = clickVisibleMatchingRecipientButtons(snapshot);

        /*
          Step 2: if nothing matched, try searching by saved visible text/title,
          then click matching search result buttons.
        */
        if (clicked === 0) {
            clicked += await searchAndClickRecipients(snapshot);
        }

        await sleep(500);

        // Recipient selection is best-effort: do not block restoration on Wilma's
        // internal hidden-field representation or demand a second confirmation.
        updateInfo();
        return clicked>0;
    }

    function collectDraft() {
        const subject = $(SEL.subject);
        const bodyHtml = getBodyHtml();
        const recipients = getRecipientsSnapshot();
        const recipientQuery=location.search.match(/(?:^|[?&])r_class(?:guardian)?=\d+/g)||[];
        // When Wilma strips query arguments after selection, infer only uniquely
        // identified whole-class chips; never infer individual people.
        if(!recipientQuery.length){
          const labels=new Set([...(recipients.visualItems||[])].flatMap(x=>[x.title,x.text]).map(x=>String(x||'').trim()).filter(Boolean));
          for(const disclosure of document.querySelectorAll('a.disclosure[href^="#collapse-school-classes-"]')){
            const id=(disclosure.getAttribute('href')||'').match(/^#collapse-school-classes-(\d+)-/);
            const name=disclosure.textContent.trim();
            if(!id||!name)continue;
            if(labels.has(name))recipientQuery.push('r_class='+id[1]);
            if(labels.has(name+':n huoltajat'))recipientQuery.push('r_classguardian='+id[1]);
          }
        }

        return {
            version: 5,
            savedAt: new Date().toISOString(),
            url: location.href,
            subject: subject ? subject.value || '' : '',
            bodyHtml,
            recipients,
            recipientQuery:recipientQuery.map(x=>x.replace(/^[?&]/,''))
        };
    }

    function isMeaningfulDraft(draft) {
        return Boolean(
            (draft.subject || '').trim() ||
            stripHtml(draft.bodyHtml || '').trim() ||
            draft.recipients?.text ||
            draft.recipients?.inputs?.length ||
            draft.recipients?.visualItems?.length
        );
    }

    function safeRead(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
    function safeReadSession(key,fallback){try{return JSON.parse(sessionStorage.getItem(key)||'null')||fallback}catch{return fallback}}
    function listHistory(){return safeRead(HISTORY_KEY,[]).filter(x=>x&&typeof x.subject==='string').slice(0,35)}
    function historySave(draft){
      const history=listHistory();
      const stamp=Date.now();
      const signature=JSON.stringify([draft.subject,draft.bodyHtml,draft.recipients?.inputs,draft.recipients?.text]);
      const last=history[0];
      if(last&&last.signature===signature)return;
      // Preserve versions at most every 2 minutes, and only on meaningful changes.
      if(last&&stamp-last.time<120000){history.shift()}
      history.unshift({id:stamp,time:stamp,signature,subject:draft.subject,bodyHtml:draft.bodyHtml,recipients:draft.recipients});
      localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(0,35)));
      window.dispatchEvent(new Event('wilmatools:drafts-changed'));
    }
    // WMT/TXT v1: shareable templates only. No snapshots or draft history exported.
    function parseOpt(v){return v==='true'?true:v==='false'?false:null}
    function sanitizeTemplateHtml(input){const box=document.createElement('div');box.innerHTML=String(input||'');box.querySelectorAll('script,iframe,object,embed,form,meta,base,link').forEach(x=>x.remove());box.querySelectorAll('*').forEach(el=>{for(const a of [...el.attributes])if(/^on/i.test(a.name)||(/^(href|src)$/i.test(a.name)&&/^\s*(?:javascript|data):/i.test(a.value)))el.removeAttribute(a.name)});return box.innerHTML}
    const templateCats=t=>Array.isArray(t.categories)&&t.categories.length?t.categories:(t.category||'Yleinen').split(';').map(x=>x.trim()).filter(Boolean);
    function exportWmt(items){
      const clean=x=>String(x||'').replace(/\r/g,'').replace(/\n/g,' ');
      return '# WilmaTools Templates v1\n\n'+items.map(t=>{
        const fields=[['id',t.id||''],['nimi',t.title],['kategoria',templateCats(t).join('; ')],['vastaanottajat',t.recipientRule||'ei_valintaa'],['aihe',t.subject||''],['viestityyppi',t.messageMode||'group'],['ryhmat',(t.recipientGroups||[]).join('; ')],['henkilot',(t.recipientIndividuals||[]).join('; ')],['sisalto_html',t.bodyHtml?encodeURIComponent(t.bodyHtml):''],['nayta_vastaanottajien_nimet',t.options?.showRecipients===true?'true':t.options?.showRecipients===false?'false':''],['nayta_vastaukset',t.options?.collatedReplies===true?'true':t.options?.collatedReplies===false?'false':''],['tekstiviesti',t.options?.sms===true?'true':t.options?.sms===false?'false':''],['sahkoposti',t.options?.email===true?'true':t.options?.email===false?'false':''],['ajastus',t.options?.scheduled===true?'true':t.options?.scheduled===false?'false':''],['lahetyspaiva',t.options?.sendDate||''],['lahetysaika',t.options?.sendTime||'']];
        return '[POHJA]\n'+fields.map(([k,v])=>k+': '+clean(v)).join('\n')+'\n\n'+String(t.body||'').replace(/\r/g,'').replace(/^\[\/POHJA\]$/gm,'[ /POHJA ]')+'\n[/POHJA]';
      }).join('\n\n')+'\n';
    }
    function importWmt(content){
      const raw=String(content||'').replace(/\r\n?/g,'\n');
      if(!raw.startsWith('# WilmaTools Templates v1'))throw Error('Tuntematon tiedostomuoto');
      const blocks=[...raw.matchAll(/^\[POHJA\]\n([\s\S]*?)^\[\/POHJA\]\s*$/gm)];
      if(!blocks.length)throw Error('Viestipohjia ei löytynyt');
      if(blocks.length>150)throw Error('Liian monta pohjaa');
      return blocks.map((block,index)=>{
        const divider=block[1].indexOf('\n\n');if(divider<0)throw Error('Pohjan sisältö puuttuu: '+(index+1));
        const meta={};
        for(const line of block[1].slice(0,divider).split('\n')){
          const m=line.match(/^([a-z_]+):\s*(.*)$/);if(!m)throw Error('Virheellinen otsake: '+line);
          meta[m[1]]=m[2];
        }
        if(!meta.nimi)throw Error('Pohjan nimi puuttuu');
        return {id:meta.id||'',title:meta.nimi,category:(meta.kategoria||'Yleinen').split(';')[0].trim(),categories:(meta.kategoria||'Yleinen').split(';').map(x=>x.trim()).filter(Boolean),bodyHtml:meta.sisalto_html?decodeURIComponent(meta.sisalto_html):'',recipientRule:meta.vastaanottajat||'ei_valintaa',messageMode:meta.viestityyppi==='single'?'single':'group',recipientGroups:(meta.ryhmat||'').split(';').map(x=>x.trim()).filter(Boolean),recipientIndividuals:(meta.henkilot||'').split(';').map(x=>x.trim()).filter(Boolean),options:{showRecipients:parseOpt(meta.nayta_vastaanottajien_nimet),collatedReplies:parseOpt(meta.nayta_vastaukset),sms:parseOpt(meta.tekstiviesti),email:parseOpt(meta.sahkoposti),scheduled:parseOpt(meta.ajastus),sendDate:meta.lahetyspaiva||'',sendTime:meta.lahetysaika||''},subject:meta.aihe||'',body:block[1].slice(divider+2).replace(/\n$/,'')};
      });
    }
    function exportFile(items){
      if(!items.length){alert('Valitse vähintään yksi viestipohja.');return}
      const blob=new Blob([exportWmt(items)],{type:'text/plain;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=items.length===1?'wilmatools-'+String(items[0].id||items[0].title||'pohja').toLowerCase().replace(/[^a-z0-9äöå-]+/g,'-').slice(0,50)+'.wmt.txt':'wilmatools-viestipohjat.wmt.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
    }
    function expandTemplate(source,values){
      return String(source||'').replace(/\{([a-z_]+(?::[a-z0-9_-]+)?)\}/gi,(match,key)=>{
        if(Object.prototype.hasOwnProperty.call(values,key))return values[key];
        const answer=prompt('Täydennä muuttuja '+match,'');
        if(answer===null)throw Error('Käyttö peruttu');
        values[key]=answer;return answer;
      });
    }
    async function selectClassRecipients(classId,type){
      if(!/^\d+$/.test(String(classId)))return {ok:false,missing:['luokan tunniste']};
      await openRecipientsPanel();
      const findPanel=()=>[...document.querySelectorAll('[id^="collapse-school-classes-"]')].find(el=>new RegExp('^collapse-school-classes-'+classId+'-').test(el.id));
      const panel=findPanel();
      if(!panel)return {ok:false,missing:['luokan vastaanottajapaneeli']};
      const disclosure=document.querySelector('a.disclosure[href="#'+panel.id+'"]');
      if(disclosure&&(disclosure.classList.contains('collapsed')||!panel.classList.contains('in')))disclosure.click();
      await sleep(300);
      const kinds=type==='both'?['Opiskelijat','Huoltajat']:type==='guardians'?['Huoltajat']:['Opiskelijat'];
      const missing=[];
      for(const kind of kinds){
        const buttons=[...panel.querySelectorAll('button.recipient-block')].filter(b=>b.textContent.trim()===kind&&!b.disabled&&!b.classList.contains('disabled'));
        if(buttons.length!==1){missing.push(kind);continue}
        const button=buttons[0];
        if(button.getAttribute('aria-pressed')!=='true'&&!button.classList.contains('active')){button.click();await sleep(250)}
        if(button.getAttribute('aria-pressed')!=='true'&&!button.classList.contains('active'))missing.push(kind);
      }
      return {ok:missing.length===0,missing};
    }
    async function selectRecipientsByNames(names){
      const targets=[...new Set((names||[]).map(x=>String(x).trim()).filter(Boolean))];
      if(!targets.length)return {selected:[],missing:[]};
      await openRecipientsPanel();
      const selected=[],missing=[];
      for(const name of targets){
        const search=$(SEL.recipientsSearchInput);
        if(!search){missing.push(name);continue}
        search.value=name;dispatchBasicEvents(search);
        await sleep(700);
        const normalize=x=>normalizeText(x||'');
        const exact=normalize(name);
        const candidates=$all(SEL.recipientButtons,document).filter(b=>{
          if(!b.getClientRects().length||b.closest('#wt-message-library'))return false;
          const sig=getRecipientButtonSignature(b);
          return [sig.text,sig.title,sig.ariaLabel].some(x=>normalize(x)===exact);
        });
        if(candidates.length!==1){missing.push(name);continue}
        candidates[0].click();await sleep(240);selected.push(name);
      }
      await clickSummaryOrCloseButtons();
      const snapshot=getRecipientsSnapshot(),visible=normalizeText(snapshot.text||'');
      return {selected:selected.filter(x=>visible.includes(normalizeText(x))),missing:[...new Set([...missing,...selected.filter(x=>!visible.includes(normalizeText(x)))])]};
    }
    function getTemplates(){return safeRead(TEMPLATE_KEY,[]).filter(x=>x&&typeof x.title==='string').slice(0,150)}
    async function selectTemplateGroups(item){
      const groups=item.recipientGroups||[],missing=[];
      for(const group of groups){
        const matches=[...document.querySelectorAll('a.disclosure[href^="#collapse-school-classes-"]')].filter(a=>a.textContent.trim()===group);
        if(matches.length!==1){missing.push(group);continue}
        const id=(matches[0].getAttribute('href')||'').match(/^#collapse-school-classes-(\d+)-/);
        if(!id){missing.push(group);continue}
        const kind=item.recipientRule==='valittujen_huoltajat'?'guardians':item.recipientRule==='valitut_opiskelijat_ja_huoltajat'?'both':'students';
        const result=await selectClassRecipients(id[1],kind);
        if(!result.ok)missing.push(group+' ('+result.missing.join(', ')+')');
      }
      const persons=item.recipientIndividuals||[];
      if(persons.length){const res=await selectRecipientsByNames(persons);missing.push(...res.missing)}
      return {ok:missing.length===0,missing};
    }
    function applyMessageOptions(options){
      if(!options)return;
      const flags=[['showRecipients','wff-ShowRecipients'],['collatedReplies','wff-CollatedReplies'],['sms','wff-AlwaysSMS'],['email','wff-AlwaysEMail'],['scheduled','wff-TimedSend']];
      for(const [key,id] of flags){const input=document.getElementById(id);const desired=options[key];if(!input||input.disabled||typeof desired!=='boolean')continue;if(input.checked!==desired)input.click()}
      if(options.scheduled!==true)return;
      for(const [key,id] of [['sendDate','wff-SendDate'],['sendTime','wff-SendTime']]){
        const input=document.getElementById(id);if(!input||input.disabled||!options[key])continue;
        input.value=options[key];dispatchBasicEvents(input);
      }
    }
    function useTemplate(item){
      const vals={paivamaara:new Date().toLocaleDateString('fi-FI')};
      if(item.messageMode==='group'&&/\{(?:etunimi|opiskelijan_nimi|huoltajan_nimi)\}/i.test((item.subject||'')+' '+(item.body||''))){alert('Ryhmäviesti sisältää yksittäisen vastaanottajan muuttujia. Valitse henkilökohtainen viesti tai muokkaa pohjaa.');return}
      try{
        const subject=expandTemplate(item.subject||'',vals),body=expandTemplate(item.body||'',vals);
        applySaved({subject,bodyHtml:item.bodyHtml?expandTemplate(sanitizeTemplateHtml(item.bodyHtml),vals):body},false);
        applyMessageOptions(item.options);
        if(item.recipientRule==='yhdistelma'&&((item.recipientGroups||[]).length||(item.recipientIndividuals||[]).length)){
          selectTemplateGroups(item).then(result=>{
            const missing=result.missing;
            // No separate confirmation gate: Wilma recipient controls remain the source of truth.
            if(missing.length)console.warn('[WilmaTools] Ryhmän vastaanottajavalinta jäi kesken:',missing);
          }).catch(()=>alert('Tarkista ryhmä- ja henkilövastaanottajat Wilmassa.'));
        }else if(item.recipients){restoreRecipients(item.recipients).catch(err=>console.warn('[WilmaTools] Pohjan vastaanottajat:',err))}
      }catch(err){if(err.message!=='Käyttö peruttu')alert(err.message)}
    }
    function applySaved(item,withRecipients){
      if(!item)return;
      const field=$(SEL.subject);if(field){field.value=item.subject||'';dispatchBasicEvents(field)}
      setBodyHtml(item.bodyHtml||item.body||'');
      if(withRecipients&&Array.isArray(item.recipientQuery)&&item.recipientQuery.length){
        const params=new URLSearchParams();for(const pair of item.recipientQuery){const [k,v]=pair.split('=');if(['r_class','r_classguardian'].includes(k)&&/^\d+$/.test(v||''))params.set(k,v)}
        if([...params].length){localStorage.setItem('wilmatools.draftRestore.v1',JSON.stringify({subject:item.subject||'',bodyHtml:item.bodyHtml||'',createdAt:Date.now()}));location.assign('/messages/compose?'+params.toString());return}
      }
      if(withRecipients&&item.recipients){restoreRecipients(item.recipients).catch(err=>console.warn('[WilmaTools] Vastaanottajien palautus epäonnistui:',err))}
    }
    function library(){
      const existing=document.getElementById('wt-message-library');if(existing){existing.hidden=false;existing.scrollIntoView({block:'nearest'});return}
      const aside=document.createElement('section');aside.id='wt-message-library';aside.setAttribute('aria-label','Viestikirjasto');
      aside.style.cssText='position:relative;flex:1 1 340px;min-width:280px;max-width:640px;background:#f7f9fc;color:#22394d;border:1px solid #cdd8e2;border-radius:6px;padding:16px;max-height:78vh;overflow:auto;font:14px/1.45 system-ui;box-sizing:border-box';
      const form=$(SEL.subject)?.closest('form');
      // NEVER reparent Wilma's form: CKEditor iframe loses its document/selection
      // when the form is detached and reinserted after editor initialization.
      if(form&&form.parentElement){
        const parent=form.parentElement;
        aside.style.cssText+=';min-width:0;width:100%;max-width:none;';
        parent.insertBefore(aside,form.nextSibling);
        const scope='wt-compose-grid-'+Math.random().toString(36).slice(2);
        parent.classList.add(scope);
        const style=document.createElement('style');
        style.textContent='.'+scope+'{display:grid!important;grid-template-columns:minmax(0,1.3fr) minmax(310px,1fr);column-gap:12px;align-items:start}.'+scope+' > :not(form):not(#wt-message-library){grid-column:1/-1}.'+scope+' > form{grid-column:1;min-width:0;width:100%}.'+scope+' > #wt-message-library{grid-column:2;grid-row:auto;min-width:0} @media(max-width:850px){.'+scope+'{grid-template-columns:minmax(0,1fr)!important}.'+scope+' > form,.'+scope+' > #wt-message-library{grid-column:1!important}}';
        document.head.append(style);
        const tabs=document.getElementById('wt-message-toolbar');
        if(tabs){aside.prepend(tabs);tabs.style.cssText='display:flex;flex-wrap:wrap;gap:4px;align-items:center;border-bottom:1px solid #d7e1e8;margin:-6px -6px 10px;padding:3px 5px;background:transparent;font:12px system-ui';}
      }else document.querySelector('main#main-content')?.prepend(aside);
      let tab=location.hash==='#wt-library-templates'?'templates':'drafts',category='Kaikki',edit=-1,recipientStatus='',exportSelected=new Set(),pendingTemplate=null;
      const sent=safeRead('wilmatools.sentTemplateImport.v1',null);
      if(sent&&Number.isFinite(sent.createdAt)&&Date.now()-sent.createdAt<15*60*1000){
        pendingTemplate={title:String(sent.subject||'Vanhasta viestistä').slice(0,120),subject:String(sent.subject||''),body:String(sent.body||''),bodyHtml:String(sent.bodyHtml||''),category:'Yleinen',recipientRule:'ei_valintaa',messageMode:'group',recipients:null};
        localStorage.removeItem('wilmatools.sentTemplateImport.v1');
        tab='templates';
      }
      window.addEventListener('wilmatools:library-tab',event=>{tab=event.detail==='drafts'?'drafts':'templates';edit=-1;draw()});
      window.addEventListener('wilmatools:compose-to-template',()=>{const current=collectDraft();pendingTemplate={title:String(current.subject||'Uusi viestipohja'),subject:current.subject||'',body:current.bodyHtml||current.body||'',category:'Yleinen',recipientRule:'ei_valintaa',messageMode:'group',recipients:null};edit=-1;tab='templates';aside.hidden=false;editor()});
      const b=(name,fn)=>{const x=document.createElement('button');x.type='button';x.textContent=name;x.onclick=fn;x.style.cssText='border:1px solid #b9cbd9;background:#eff6fb;border-radius:6px;padding:7px;margin:4px;color:#234968;cursor:pointer;font:inherit';return x};
      const label=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
      function draw(){
       const tabs=aside.querySelector('#wt-message-toolbar');aside.replaceChildren();if(tabs)aside.append(tabs);const header=label('h2','Viestikirjasto');header.style.margin='0 0 10px';aside.append(header,b('Sulje',()=>{aside.hidden=true;window.dispatchEvent(new Event('wilmatools:library-closed'))}));
       if(tab==='drafts'){
        const drafts=[...listHistory()];
        const latest=loadDraft();
        if(latest)drafts.unshift({...latest,time:latest.savedAt||new Date().toISOString(),_latest:true});
        const heading=label('label','Valitse luonnos');heading.style.cssText='display:block;font-weight:600;margin:12px 0 4px';
        const select=document.createElement('select');select.style.cssText='width:100%;max-width:100%;padding:8px;border:1px solid #b9cbd9;border-radius:5px';
        const placeholder=label('option','Valitse tallenne…');placeholder.value='';select.append(placeholder);
        drafts.forEach((item,i)=>{const date=new Date(item.time||item.savedAt);const when=Number.isNaN(date.getTime())?'':date.toLocaleString('fi-FI');const option=label('option',(item._latest?'Viimeisin automaattitallenne':'Luonnos')+' · '+(item.subject||'Nimetön')+' · '+when);option.value=String(i);select.append(option)});
        select.onchange=()=>{if(select.value==='')return;const draft=drafts[Number(select.value)];if(!draft)return;applySaved(draft,true);aside.hidden=true;window.dispatchEvent(new Event('wilmatools:library-closed'))};
        aside.append(heading,select);
        const count=label('p',drafts.length+' tallennetta. Valinta palauttaa otsikon, tekstin ja vastaanottajat.');count.style.cssText='font-size:12px;color:#607080;margin:8px 0';aside.append(count);
       }else{
        const data=getTemplates(),cats=['Kaikki',...new Set(data.flatMap(templateCats))].sort((a,b)=>a==='Kaikki'?-1:b==='Kaikki'?1:a.localeCompare(b,'fi'));
        const search=label('input','');search.type='search';search.placeholder='Hae viestipohjia…';search.setAttribute('aria-label','Hae viestipohjia');search.style.cssText='width:100%;padding:8px;margin:6px 0;border:1px solid #b9cbd9;border-radius:5px';
        const categoryChoice=document.createElement('select');categoryChoice.style.cssText='width:100%;padding:8px;margin:5px 0;border:1px solid #b9cbd9;border-radius:5px';
        for(const c of cats){const op=label('option',c);op.value=c;categoryChoice.append(op)}
        categoryChoice.value=cats.includes(category)?category:'Kaikki';
        const templateChoice=document.createElement('select');templateChoice.style.cssText='width:100%;padding:8px;margin:5px 0;border:1px solid #b9cbd9;border-radius:5px';
        const picked=label('div','');picked.style.cssText='font-size:12px;color:#536979;margin:5px 0';
        const tree=()=>{
          category=categoryChoice.value;
          templateChoice.replaceChildren();
          const first=label('option','Valitse viestipohja…');first.value='';templateChoice.append(first);
          const q=search.value.trim().toLocaleLowerCase('fi');
          const groups=category==='Kaikki'?cats.filter(x=>x!=='Kaikki'):[category];
          const shown=new Set();
          for(const group of groups){
            const matches=data.map((t,i)=>({t,i})).filter(({t,i})=>!shown.has(i)&&templateCats(t).includes(group)&&(!q||(t.title+' '+(t.subject||'')+' '+templateCats(t).join(' ')).toLocaleLowerCase('fi').includes(q)));
            if(!matches.length)continue;
            const node=document.createElement('optgroup');node.label=group;
            for(const {t,i} of matches){const op=label('option',t.title);op.value=String(i);node.append(op);shown.add(i)}
            templateChoice.append(node);
          }
          picked.textContent=shown.size+' viestipohjaa';
        };
        search.oninput=tree;categoryChoice.onchange=tree;
        templateChoice.onchange=()=>{if(templateChoice.value==='')return;const item=data[Number(templateChoice.value)];if(item)useTemplate(item)};
        aside.append(search,categoryChoice,templateChoice,picked);
        tree();
        const manage=label('details','');const caption=label('summary','Viestipohjien hallinta');caption.style.cssText='cursor:pointer;margin:12px 0;color:#315c7a;font-weight:600';manage.append(caption);aside.append(manage);
        manage.append(b('Uusi viestipohja',()=>{edit=-1;editor()}));
        manage.append(b('Vie kaikki .wmt.txt',()=>exportFile(data)));
        manage.append(b('Vie valitut ('+exportSelected.size+')',()=>exportFile(data.filter((x,i)=>exportSelected.has(i)))));
        const upload=document.createElement('input');upload.type='file';upload.accept='.txt,text/plain';upload.style.maxWidth='100%';
        upload.onchange=async()=>{const file=upload.files?.[0];if(!file)return;
          try{if(file.size>500000)throw Error('Tiedosto on liian suuri');const incoming=importWmt(await file.text());
            if(!confirm('Tuotavat viestipohjat ('+incoming.length+'):\n'+incoming.map(x=>x.title+' ['+x.category+']').join('\n').slice(0,1300)+'\n\nTuodaanko nämä pohjat?'))return;
            const all=getTemplates();let replaced=0,added=0;
            for(const item of incoming){
              const identity=x=>(x.id&&x.id.trim())?('id:'+x.id.trim()):('name:'+x.title.trim().toLocaleLowerCase('fi')+'|'+(x.category||'Yleinen').trim().toLocaleLowerCase('fi'));
              const key=identity(item),existing=all.findIndex(x=>identity(x)===key);
              if(existing>=0){
                if(confirm('Viestipohja "'+item.title+'" on jo olemassa. Korvataanko vanha versio?')){all[existing]={...item,recipients:null};replaced++}
              }else if(all.length<150){all.push({...item,recipients:null});added++}
            }
            localStorage.setItem(TEMPLATE_KEY,JSON.stringify(all));exportSelected.clear();alert('Tuotu uusia: '+added+'. Päivitetty: '+replaced+'.');draw();
          }catch(err){alert('Tuonti epäonnistui: '+err.message)}
        };manage.append(upload);
        data.forEach((item,i)=>{if(category!=='Kaikki'&&!templateCats(item).includes(category))return;const row=label('div','');row.style.cssText='border-bottom:1px solid #ddd;padding:10px 0';row.append(label('strong',item.title),label('div',templateCats(item).join(', ')));const tick=document.createElement('input');tick.type='checkbox';tick.checked=exportSelected.has(i);tick.onchange=()=>{if(tick.checked)exportSelected.add(i);else exportSelected.delete(i);draw()};row.prepend(tick);row.append(b('Käytä',()=>useTemplate(item)),b('Vie .txt',()=>exportFile([item])),b('Muokkaa',()=>{edit=i;editor()}),b('Poista',()=>{if(confirm('Poistetaanko pohja?')){data.splice(i,1);exportSelected.clear();localStorage.setItem(TEMPLATE_KEY,JSON.stringify(data));draw()}}));manage.append(row)});
       }
       const names=safeReadSession('wilmatools.recipientReminder.v1',[]);
       if(names.length){const note=label('div','Valitse Wilmassa vastaanottajat: '+names.join(', '));note.style.cssText='padding:9px;background:#fff6da;border:1px solid #e3cd91;border-radius:6px';aside.append(note);aside.append(b('Vastaanottajat tarkistettu',()=>{sessionStorage.removeItem('wilmatools.recipientReminder.v1');draw()}))}
       if(recipientStatus){const receipt=label('p',recipientStatus);receipt.style.cssText='padding:8px;background:#fff7e5;border-radius:5px;color:#69501e';aside.append(receipt)}
       const hint=label('p','Tallenteet säilyvät vain tässä selaimessa.');hint.style.color='#687987';aside.append(hint)
      }
      function editor(){
       const tabs=aside.querySelector('#wt-message-toolbar');aside.replaceChildren();if(tabs)aside.append(tabs);aside.append(label('h2','Viestipohja'));
       const item=getTemplates()[edit]||pendingTemplate||{title:'',category:'Yleinen',subject:'',body:'',recipientRule:'valitut_opiskelijat',recipients:null};
       const fields={};for(const [key,name,multi]of [['title','Nimi',false],['category','Kategoriat (erota puolipisteellä)',false],['subject','Aihe',false],['body','Viesti',true]]){
        const l=label('label',name);l.style.cssText='display:block;margin:10px 0';const inp=document.createElement(multi?'textarea':'input');if(multi)inp.rows=7;inp.value=key==='category'?templateCats(item).join('; '):item[key]||'';inp.style.cssText='display:block;width:100%;padding:8px;box-sizing:border-box;border:1px solid #bacbd7';l.append(inp);aside.append(l);fields[key]=inp;
       }
       // Use a rich, in-page editor so formatting remains editable, not raw HTML text.
       const rich=label('div','');rich.contentEditable='true';rich.setAttribute('role','textbox');rich.setAttribute('aria-label','Viestipohjan muotoiltu sisältö');rich.style.cssText='min-height:145px;border:1px solid #bacbd7;background:#fff;padding:10px;margin:6px 0 12px;white-space:normal;overflow-wrap:anywhere';rich.innerHTML=sanitizeTemplateHtml(item.bodyHtml||'');
       if(!item.bodyHtml)rich.textContent=item.body||'';
       fields.body.closest('label').style.display='none';aside.insertBefore(rich,fields.body.closest('label').nextSibling);
       const help=label('div','Muuttujat merkitään aaltosulkeilla: {etunimi}, {opiskelijan_nimi}, {opettajan_nimi}, {paivamaara}, {linkki:ohje}. Kirjoita sama muuttuja aiheeseen tai tekstiin. Käytettäessä tuntemattoman muuttujan arvo kysytään. Yhteisviestissä ei täytetä automaattisesti yksittäisen opiskelijan etunimeä.');help.style.cssText='padding:10px;background:#eef5fb;border-radius:7px;white-space:normal;font-size:12px';aside.append(help);
       const role=label('label','Vastaanottajatapa');role.style.cssText='display:block;margin:10px 0';const choice=document.createElement('select');
       for(const [value,name] of [['ei_valintaa','Valitaan Wilmassa käsin'],['valitut_opiskelijat','Valitut opiskelijat'],['valittujen_huoltajat','Valittujen opiskelijoiden huoltajat'],['valitut_opiskelijat_ja_huoltajat','Opiskelijat ja huoltajat'],['pohjaan_tallennetut','Pohjaan tallennetut vastaanottajat'],['yhdistelma','Ryhmiä ja yksittäisiä henkilöitä']]){
        const option=label('option',name);option.value=value;choice.append(option);
       }
       choice.value=item.recipientRule||'ei_valintaa';role.append(choice);aside.append(role);
       const modeLabel=label('label','Viestityyppi');modeLabel.style.cssText='display:block;margin:10px 0';const mode=document.createElement('select');
       for(const [value,name] of [['single','Yksittäinen henkilökohtainen viesti'],['group','Yhteinen ryhmäviesti']]){const option=label('option',name);option.value=value;mode.append(option)}
       mode.value=item.messageMode||'group';modeLabel.append(mode);aside.append(modeLabel);const recipientFields={};for(const [key,name] of [['recipientGroups','Ryhmät / luokat (yksi per rivi)'],['recipientIndividuals','Yksittäiset henkilöt (yksi per rivi)']]){const field=label('label',name);field.style.cssText='display:block;margin:9px 0';const input=document.createElement('textarea');input.rows=3;input.value=(item[key]||[]).join('\n');input.style.cssText='display:block;width:100%;box-sizing:border-box;border:1px solid #bacbd7;padding:7px';field.append(input);aside.append(field);recipientFields[key]=input;}
       const optBox=label('fieldset','');optBox.style.cssText='border:1px solid #c8d7e3;padding:10px;margin:10px 0';optBox.append(label('legend','Wilman lisäasetukset ja ajastus'));const optionControls={};
       for(const [key,name] of [['showRecipients','Näytä vastaanottajien nimet'],['collatedReplies','Näytä vastaanottajien vastaukset'],['sms','Lähetä myös tekstiviestinä'],['email','Lähetä myös sähköpostina'],['scheduled','Ajasta lähetys']]){
        const line=label('label',' '+name);line.style.cssText='display:block;margin:7px 0';const input=document.createElement('select');for(const [value,title] of [['','Säilytä Wilman oletus'],['true','Kyllä'],['false','Ei']]){const op=label('option',title);op.value=value;input.append(op)}const saved=item.options?.[key];input.value=saved===true?'true':saved===false?'false':'';line.prepend(input);optBox.append(line);optionControls[key]=input;
       }
       for(const [key,name,example] of [['sendDate','Lähetyspäivä','pp.kk.vvvv'],['sendTime','Lähetysaika','tt:mm']]){const line=label('label',name);line.style.cssText='display:block;margin:7px 0';const input=document.createElement('input');input.type='text';input.placeholder=example;input.value=item.options?.[key]||'';input.style.cssText='display:block;width:100%;padding:6px;box-sizing:border-box';line.append(input);optBox.append(line);optionControls[key]=input}
       aside.append(optBox);
       const chk=document.createElement('input');chk.type='checkbox';chk.checked=!!item.recipients;
       const rec=label('label',' Tallenna myös nykyiset vastaanottajat');rec.prepend(chk);aside.append(rec);
       aside.append(b('Tallenna',()=>{const all=getTemplates();const next={id:item.id||'',title:fields.title.value.trim(),category:(fields.category.value.split(';')[0]||'Yleinen').trim(),categories:fields.category.value.split(';').map(x=>x.trim()).filter(Boolean),bodyHtml:sanitizeTemplateHtml(rich.innerHTML),subject:fields.subject.value,body:rich.innerText||rich.textContent||'',options:{showRecipients:parseOpt(optionControls.showRecipients.value),collatedReplies:parseOpt(optionControls.collatedReplies.value),sms:parseOpt(optionControls.sms.value),email:parseOpt(optionControls.email.value),scheduled:parseOpt(optionControls.scheduled.value),sendDate:optionControls.sendDate.value.trim(),sendTime:optionControls.sendTime.value.trim()},recipientRule:choice.value,messageMode:mode.value,recipientGroups:recipientFields.recipientGroups.value.split('\n').map(x=>x.trim()).filter(Boolean),recipientIndividuals:recipientFields.recipientIndividuals.value.split('\n').map(x=>x.trim()).filter(Boolean),recipients:chk.checked?(edit>=0&&item.recipients?item.recipients:getRecipientsSnapshot()):null};if(!next.title)return;if(edit<0)all.push(next);else all[edit]=next;pendingTemplate=null;localStorage.setItem(TEMPLATE_KEY,JSON.stringify(all));draw()}),b('Takaisin',draw));
      }
      if(pendingTemplate)editor();else draw();
      window.addEventListener('wilmatools:drafts-changed',()=>{if(!aside.hidden&&tab==='drafts')draw()});

    }
    function addLibraryEntry(){
      if(document.getElementById('wt-library-entry'))return;
      const button=document.createElement('button');button.id='wt-library-entry';button.type='button';button.textContent='Viestikirjasto';button.style.cssText='display:inline-block;margin:8px 0;padding:7px 12px;background:#e9f1f6;color:#164c77;border:1px solid #b8ccda;border-radius:5px;cursor:pointer';button.onclick=library;const subject=$(SEL.subject);const form=subject?.closest('form');const target=form?.querySelector('#wff-Subject')?.parentElement||subject?.parentElement;if(!document.getElementById('wt-message-toolbar')){if(target)target.insertAdjacentElement('afterend',button);else document.body.append(button)}
      library();
      const savedRestore=safeRead('wilmatools.draftRestore.v1',null);
      if(savedRestore&&Date.now()-savedRestore.createdAt<120000){localStorage.removeItem('wilmatools.draftRestore.v1');applySaved(savedRestore,false)}
      const request=safeRead(REQUEST_KEY,null);
      if(request&&Date.now()-request.createdAt<120000){
        localStorage.removeItem(REQUEST_KEY);
        if(request.subject||request.body){
          const current=collectDraft();
          if(!isMeaningfulDraft(current)){
            const safe=document.createElement('div');safe.textContent=String(request.body||'');
            applySaved({subject:String(request.subject||''),bodyHtml:safe.innerHTML.replaceAll('\\n','<br>')},false);
          }
        }
        const task=request.recipientClassId
          ?selectClassRecipients(request.recipientClassId,request.recipientType)
          :Promise.resolve({ok:true,missing:[]});
        task.then(result=>{
          if(!result.ok){
            library();const pane=document.getElementById('wt-message-library');
            if(pane){const note=document.createElement('p');note.textContent='Valintaa ei voitu vahvistaa: '+result.missing.join(', ')+'. Tarkista vastaanottajat Wilmassa.';pane.prepend(note)}
          }
        }).catch(err=>console.warn('[WilmaTools] Recipient selection failed:',err));
      }
      window.addEventListener('wilmatools:show-library',event=>{if(event.detail?.section==='message'){const lib=document.getElementById('wt-message-library');if(lib){lib.hidden=false;const sections=[...lib.children].filter(el=>el.id!=='wt-message-toolbar');sections.forEach(el=>el.hidden=true)}return}library();window.dispatchEvent(new CustomEvent('wilmatools:library-tab',{detail:event.detail?.section}))});
      window.addEventListener('wilmatools:save-compose-template',()=>{library();window.dispatchEvent(new Event('wilmatools:compose-to-template'))});
      window.addEventListener('wilmatools:open-library',()=>{const lib=document.getElementById('wt-message-library');if(lib)lib.hidden=false;else library()});
    }
    function saveDraft(reason) {
        try {
            const draft = collectDraft();

            if (!isMeaningfulDraft(draft)) {
                setIndicator('Wilma Autosaver: running, nothing to save yet', 'ok');
                return;
            }

            const json = JSON.stringify(draft);

            if (json === lastSavedJson) {
                return;
            }

            localStorage.setItem(STORAGE_KEY, json);
            historySave(draft);
            lastSavedJson = json;

            const bodyLen = stripHtml(draft.bodyHtml).trim().length;
            const recCount = draft.recipients.inputs.length;
            const visualCount = draft.recipients.visualItems.length;

            setIndicator(
                `Wilma Autosaver: saved ${new Date().toLocaleTimeString()} | recipients ${recCount}/${visualCount} | body ${bodyLen} chars`,
                'ok'
            );

            updateInfo();
        } catch (err) {
            setIndicator('Wilma Autosaver save error: ' + err.message, 'error');
        }
    }

    function loadDraft() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            setIndicator('Wilma Autosaver load error: ' + err.message, 'error');
            return null;
        }
    }

    async function restoreSavedDraft(force) {
        const draft = loadDraft();

        if (!draft) {
            setIndicator('Wilma Autosaver: no saved draft found', 'error');
            return;
        }

        if (force) {
            const ok = confirm('Restore saved local draft over current page content?');
            if (!ok) return;
        }

        // Individual recipients are not restored automatically.

        const subject = $(SEL.subject);
        if (subject) {
            subject.value = draft.subject || '';
            dispatchBasicEvents(subject);
        }

        setBodyHtml(draft.bodyHtml || '');

        const bodyLen = stripHtml(draft.bodyHtml || '').trim().length;
        setIndicator(`Wilma Autosaver: restored draft | body ${bodyLen} chars`, 'ok');
        updateInfo();
    }

    function updateInfo() {
        const info = $('#wilma-as-info');
        if (!info) return;

        const draft = loadDraft();

        if (!draft) {
            info.textContent = 'No saved local draft.';
            return;
        }

        const saved = draft.savedAt
            ? new Date(draft.savedAt).toLocaleString()
            : 'unknown time';

        const recCount = draft.recipients?.inputs?.length || 0;
        const visualCount = draft.recipients?.visualItems?.length || 0;
        const visibleRecText = (draft.recipients?.text || '').trim();
        const bodyLen = stripHtml(draft.bodyHtml || '').trim().length;
        const subject = draft.subject ? ` | ${draft.subject.slice(0, 40)}` : '';

        info.textContent =
            `Saved: ${saved}` +
            ` | hidden recipients: ${recCount}` +
            ` | visual items: ${visualCount}` +
            ` | visible text: ${visibleRecText ? 'yes' : 'no'}` +
            ` | body: ${bodyLen} chars${subject}`;
    }

    function pageLooksEmpty() {
        const draft = collectDraft();
        return !isMeaningfulDraft(draft);
    }

    async function offerRestoreIfEmpty() {
        const draft = loadDraft();

        if (!draft) {
            updateInfo();
            return;
        }

        if (!pageLooksEmpty()) {
            updateInfo();
            return;
        }

        const bodyLen = stripHtml(draft.bodyHtml || '').trim().length;
        const recCount = draft.recipients?.inputs?.length || 0;
        const visualCount = draft.recipients?.visualItems?.length || 0;

        const ok = confirm(
            `Wilma Autosaver found a saved local draft.\n\n` +
            `Hidden recipients: ${recCount}\n` +
            `Visual recipient items: ${visualCount}\n` +
            `Message length: ${bodyLen} chars\n\n` +
            `Restore it?`
        );

        if (ok) {
            await restoreSavedDraft(false);
        }
    }

    function attachListeners() {
        const subject = $(SEL.subject);
        if (subject && !subject.dataset.wilmaAsWatched) {
            subject.dataset.wilmaAsWatched = '1';
            subject.addEventListener('input', () => scheduleSave('subject'));
            subject.addEventListener('change', () => scheduleSave('subject'));
        }

        const textarea = $(SEL.bodyTextarea);
        if (textarea && !textarea.dataset.wilmaAsWatched) {
            textarea.dataset.wilmaAsWatched = '1';
            textarea.addEventListener('input', () => scheduleSave('textarea'));
            textarea.addEventListener('change', () => scheduleSave('textarea'));
        }

        const cell = $(SEL.recipientsCell);
        if (cell && !cell.dataset.wilmaAsWatched) {
            cell.dataset.wilmaAsWatched = '1';

            const observer = new MutationObserver(() => scheduleSave('recipients'));
            observer.observe(cell, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }

        const editor = getCkeditorInstance();
        if (editor && !editor._wilmaAsWatched) {
            editor._wilmaAsWatched = true;

            editor.on('change', () => scheduleSave('ckeditor'));
            editor.on('key', () => scheduleSave('ckeditor'));
            editor.on('blur', () => saveDraft('ckeditor blur'));
        }

        const iframeDoc = getCkeditorIframeDocument();
        if (iframeDoc && iframeDoc.body && !iframeDoc.body.dataset.wilmaAsWatched) {
            iframeDoc.body.dataset.wilmaAsWatched = '1';

            iframeDoc.body.addEventListener('input', () => scheduleSave('iframe'));
            iframeDoc.body.addEventListener('keyup', () => scheduleSave('iframe'));
            iframeDoc.body.addEventListener('paste', () => scheduleSave('iframe'));

            const observer = new MutationObserver(() => scheduleSave('iframe mutation'));
            observer.observe(iframeDoc.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        const send = $(SEL.sendButton);
        if (send && !send.dataset.wilmaAsWatched) {
            send.dataset.wilmaAsWatched = '1';
            send.addEventListener('click', () => saveDraft('before send'), true);
        }

        const draft = $(SEL.draftButton);
        if (draft && !draft.dataset.wilmaAsWatched) {
            draft.dataset.wilmaAsWatched = '1';
            draft.addEventListener('click', () => saveDraft('before Wilma draft'), true);
        }

        const cancel = $(SEL.cancelButton);
        if (cancel && !cancel.dataset.wilmaAsWatched) {
            cancel.dataset.wilmaAsWatched = '1';
            cancel.addEventListener('click', () => saveDraft('before cancel'), true);
        }
    }

    function scheduleSave(reason) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveDraft(reason), 350);
    }

    async function init() {
        ensureUi();
        setIndicator('Wilma Autosaver: injected, looking for compose fields...', null);

        let tries = 0;

        const timer = setInterval(async () => {
            tries += 1;

            const hasSubject = Boolean($(SEL.subject));
            const hasBody = Boolean($(SEL.bodyTextarea));
            const hasRecipients = Boolean($(SEL.recipientsCell));
            const hasIframe = Boolean(getCkeditorIframeDocument());
            const hasCke = Boolean(getCkeditorInstance());

            if (!hasSubject || !hasBody) {
                setIndicator(
                    `Wilma Autosaver: waiting ${tries}s | subject=${hasSubject} body=${hasBody} recipients=${hasRecipients}`,
                    null
                );

                if (tries >= 45) {
                    clearInterval(timer);
                    setIndicator(
                        `Wilma Autosaver: failed to find fields | subject=${hasSubject} body=${hasBody} recipients=${hasRecipients}`,
                        'error'
                    );
                }

                return;
            }

            if (!initialized) {
                initialized = true;
                addLibraryEntry();

                setIndicator(
                    `Wilma Autosaver: running | recipients=${hasRecipients} ckeditor=${hasCke} iframe=${hasIframe}`,
                    'ok'
                );

                // Restoration is always user-initiated from the library.
            }

            attachListeners();

            // Event-driven autosave only.

            updateInfo();
        }, 1000);
    }

    // The desktop toolbar can reopen the local controls without changing save/restore logic.
    window.addEventListener('wilmatools:open-autosaver', () => {const lib=document.getElementById('wt-message-library');if(lib)lib.hidden=false;else library()});
    ready(init);
})();