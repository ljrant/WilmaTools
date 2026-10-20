// ==UserScript==
// @name         WilmaTools - Message Autosaver (Chrome Desktop)
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.7.0
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
        if(window.__wilmaToolsHub) el.style.display='none';
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

        if (window.__wilmaToolsHub) panel.style.display = 'none';
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
        const editor = getCkeditorInstance();

        if (editor && typeof editor.setData === 'function') {
            editor.setData(html || '', {
                callback: function () {
                    if (typeof editor.updateElement === 'function') {
                        editor.updateElement();
                    }

                    const textarea = $(SEL.bodyTextarea);
                    if (textarea) {
                        textarea.value = html || '';
                        dispatchBasicEvents(textarea);
                    }
                }
            });
            return;
        }

        const iframeDoc = getCkeditorIframeDocument();
        if (iframeDoc && iframeDoc.body) {
            iframeDoc.body.innerHTML = html || '';
            dispatchBasicEvents(iframeDoc.body);
            return;
        }

        const textarea = $(SEL.bodyTextarea);
        if (textarea) {
            textarea.value = html || '';
            dispatchBasicEvents(textarea);
        }
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

        /*
          Step 3: restore form-level hidden inputs/chips as backup.
          This is still useful if Wilma's visual state does not fully update.
        */
        const cell = $(SEL.recipientsCell);
        if (cell && snapshot.html) {
            cell.innerHTML = snapshot.html;
            dispatchBasicEvents(cell);

            $all('input[type="hidden"]', cell).forEach(input => {
                dispatchBasicEvents(input);
            });
        }

        await sleep(400);

        /*
          Step 4: try to force visual summary refresh.
        */
        const summaryClicks = await clickSummaryOrCloseButtons();

        await sleep(300);

        const visibleTextNow = cell
            ? (cell.innerText || cell.textContent || '').trim()
            : '';

        const hiddenInputsNow = cell
            ? $all('input[type="hidden"]', cell).length
            : 0;

        setIndicator(
            `Wilma Autosaver: recipients restore done | clicked=${clicked} | hidden=${hiddenInputsNow} | visible=${visibleTextNow ? 'yes' : 'no'} | summary=${summaryClicks}`,
            hiddenInputsNow || clicked ? 'ok' : 'error'
        );

        updateInfo();

        return Boolean(hiddenInputsNow || clicked);
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
                createPanel();

                setIndicator(
                    `Wilma Autosaver: running | recipients=${hasRecipients} ckeditor=${hasCke} iframe=${hasIframe}`,
                    'ok'
                );

                await offerRestoreIfEmpty();
            }

            attachListeners();

            if (tries % 2 === 0) {
                saveDraft('auto');
            }

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