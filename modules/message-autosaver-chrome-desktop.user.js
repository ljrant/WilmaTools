        // Never inject saved recipient HTML or hidden inputs into Wilma's form.
        // The recipient picker owns its own state; manual verification is mandatory.
        const cell=$(SEL.recipientsCell);
        const matched=getRecipientsSnapshot();
        const desired=new Set((snapshot.inputs||[]).map(x=>x.value).filter(Boolean));
        const actual=new Set((matched.inputs||[]).map(x=>x.value).filter(Boolean));
        const verified=desired.size>0&&[...desired].every(x=>actual.has(x));
        if(!verified)console.warn('[WilmaTools] Recipient selection requires manual verification.');
                updateInfo();

        return verified;
    }

    function collectDraft() {
        const subject = $(SEL.subject);
        const bodyHtml = getBodyHtml();
        const recipients = getRecipientsSnapshot();

        return {
            version: 5,
            savedAt: new Date().toISOString(),
            url: location.href,
            subject: subject ? subject.value || '' : '',
            bodyHtml,
            recipients
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
    function getTemplates(){return safeRead(TEMPLATE_KEY,[]).filter(x=>x&&typeof x.title==='string').slice(0,60)}
    function applySaved(item,withRecipients){
      if(!item)return;
      const field=$(SEL.subject);if(field){field.value=item.subject||'';dispatchBasicEvents(field)}
      setBodyHtml(item.bodyHtml||item.body||'');
      if(withRecipients&&item.recipients)restoreRecipients(item.recipients).then(ok=>{
       if(!ok)console.warn('[WilmaTools] Check recipients manually before sending.');
      });
    }
    function library(){
      const existing=document.getElementById('wt-message-library');if(existing){existing.hidden=!existing.hidden;return}
      const aside=document.createElement('aside');aside.id='wt-message-library';
      aside.style.cssText='position:fixed;right:0;top:0;height:100vh;width:min(370px,93vw);background:white;color:#22394d;z-index:2147483400;box-shadow:-4px 0 18px #0002;padding:17px;overflow-y:auto;font:14px/1.45 system-ui;box-sizing:border-box';
      document.body.append(aside);
      let tab='drafts',category='Kaikki',edit=-1;
      const b=(name,fn)=>{const x=document.createElement('button');x.type='button';x.textContent=name;x.onclick=fn;x.style.cssText='border:1px solid #b9cbd9;background:#eff6fb;border-radius:6px;padding:7px;margin:4px;color:#234968;cursor:pointer;font:inherit';return x};
      const label=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
      function draw(){
       aside.replaceChildren();const header=label('h2','Viestikirjasto');header.style.margin='0 0 10px';aside.append(header,b('Sulje',()=>aside.hidden=true));
       aside.append(b('Luonnokset',()=>{tab='drafts';draw()}),b('Viestipohjat',()=>{tab='templates';draw()}));
       if(tab==='drafts'){
        const current=loadDraft();if(current)aside.append(b('Viimeisin automaattitallenne',()=>applySaved(current,true)));
        for(const item of listHistory()){
         const row=label('div','');row.style.cssText='border-bottom:1px solid #ddd;padding:9px 0';
         row.append(label('strong',item.subject||'Nimetön viesti'),label('div',new Date(item.time).toLocaleString('fi-FI')));
         row.append(b('Palauta',()=>{if(confirm('Korvataanko viestin sisältö tallenteella?'))applySaved(item,true)}));
         row.append(b('Tallenna pohjaksi',()=>{const arr=getTemplates();arr.push({title:item.subject||'Uusi pohja',category:'Yleinen',subject:item.subject,body:item.bodyHtml,recipients:item.recipients});localStorage.setItem(TEMPLATE_KEY,JSON.stringify(arr));tab='templates';draw()}));aside.append(row)
        }
       }else{
        const data=getTemplates(),cats=['Kaikki',...new Set(data.map(x=>x.category||'Yleinen'))];
        const select=document.createElement('select');for(const c of cats){const opt=label('option',c);opt.value=c;select.append(opt)}select.value=cats.includes(category)?category:'Kaikki';select.onchange=()=>{category=select.value;draw()};aside.append(select);
        aside.append(b('Uusi viestipohja',()=>{edit=-1;editor()}));
        data.forEach((item,i)=>{if(category!=='Kaikki'&&(item.category||'Yleinen')!==category)return;const row=label('div','');row.style.cssText='border-bottom:1px solid #ddd;padding:10px 0';row.append(label('strong',item.title),label('div',item.category||'Yleinen'));row.append(b('Käytä',()=>applySaved(item,true)),b('Muokkaa',()=>{edit=i;editor()}),b('Poista',()=>{if(confirm('Poistetaanko pohja?')){data.splice(i,1);localStorage.setItem(TEMPLATE_KEY,JSON.stringify(data));draw()}}));aside.append(row)});
       }
       const hint=label('p','Vastaanottajat on tarkistettava Wilmassa ennen lähettämistä. Tallenteet säilyvät vain tässä selaimessa.');hint.style.color='#687987';aside.append(hint)
      }
      function editor(){
       aside.replaceChildren();aside.append(label('h2','Viestipohja'));
       const item=getTemplates()[edit]||{title:'',category:'Yleinen',subject:'',body:'',recipients:null};
       const fields={};for(const [key,name,multi]of [['title','Nimi',false],['category','Kategoria',false],['subject','Aihe',false],['body','Viesti',true]]){
        const l=label('label',name);l.style.cssText='display:block;margin:10px 0';const inp=document.createElement(multi?'textarea':'input');if(multi)inp.rows=7;inp.value=item[key]||'';inp.style.cssText='display:block;width:100%;padding:8px;box-sizing:border-box;border:1px solid #bacbd7';l.append(inp);aside.append(l);fields[key]=inp;
       }
       const chk=document.createElement('input');chk.type='checkbox';chk.checked=!!item.recipients;
       const rec=label('label',' Tallenna myös nykyiset vastaanottajat');rec.prepend(chk);aside.append(rec);
       aside.append(b('Tallenna',()=>{const all=getTemplates();const next={title:fields.title.value.trim(),category:fields.category.value.trim()||'Yleinen',subject:fields.subject.value,body:fields.body.value,recipients:chk.checked?getRecipientsSnapshot():null};if(!next.title)return;if(edit<0)all.push(next);else all[edit]=next;localStorage.setItem(TEMPLATE_KEY,JSON.stringify(all));draw()}),b('Takaisin',draw));
      }
      draw();
      window.addEventListener('wilmatools:drafts-changed',()=>{if(!aside.hidden&&tab==='drafts')draw()});
    }
    function addLibraryEntry(){
      if(document.getElementById('wt-library-entry'))return;
      const button=document.createElement('button');button.id='wt-library-entry';button.type='button';button.textContent='Viestikirjasto';button.style.cssText='position:fixed;right:12px;bottom:12px;padding:10px 15px;background:#164c77;color:#fff;border:0;border-radius:8px;z-index:2147483300;cursor:pointer';button.onclick=library;document.body.append(button);
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

        await restoreRecipients(draft.recipients);

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

        const ok = false && confirm(
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

                // Recover drafts from the library on demand; never interrupt composing.
            }

            attachListeners();

            // Event-driven autosave: avoid overwriting drafts on a timer.

            updateInfo();
        }, 1000);
    }

    // The desktop toolbar can reopen the local controls without changing save/restore logic.
    window.addEventListener('wilmatools:open-autosaver', () => {
      const panel = document.querySelector('#wilma-as-panel');
      if (panel) panel.style.display = 'block';
      else createPanel();
    });
    ready(init);
})();