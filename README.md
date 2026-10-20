# WilmaTools

**Suomi (oletus) / English**

WilmaTools is a browser-based collection of optional tools for Wilma. Current module: **Ryhmänohjaajan opintoseuranta / Homeroom course progress**.

## Installation / Asennus

1. Install Tampermonkey.
2. [Install WilmaTools.user.js](https://raw.githubusercontent.com/ljrant/WilmaTools/main/WilmaTools.user.js) (or paste the script into Tampermonkey).
3. Open an authorized Wilma student gradebook at `https://<school>.inschool.fi/profiles/students/.../choices?view=gradebook`.
4. Click **WilmaTools**.

The script supports **any school subdomain** under `https://*.inschool.fi` (for example, `espoo.inschool.fi`), on the student gradebook page. It does not automatically support other Wilma domains outside `inschool.fi`. The script fetches only same-origin student pages in your current school session; no cross-school requests are made.

Käyttäjäskripti toimii **kaikilla `*.inschool.fi`-aliverkkotunnuksilla** opiskelijan suoritussivulla. Tietoja haetaan vain avoinna olevan koulun palvelimelta, ei muiden koulujen palvelimilta.

## Desktop toolbar / Tietokoneen työkalupalkki

**[Install desktop toolbar / Asenna tietokoneen työkalupalkki](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/desktop-toolbar.user.js)**

The toolbar now adds a persistent **WilmaTools sidebar trigger on all desktop Wilma pages**, with a single consistent tool menu. Finnish is the default; switch to English in the menu. Each tool remains a **separate Tampermonkey userscript**, enabled/disabled independently from Tampermonkey. The sidebar navigates to the applicable Wilma page; on a supported page it opens the installed module. Availability and behavior depend on which Tampermonkey scripts are installed/enabled. An extra shortcut on the Wilma start page opens the **last visited student gradebook** in the same school, if available; otherwise it points to Wilma's student list. Firefox Android uses its separate mobile UI.

**Desktop installation / Asennus tietokoneella:** Install the toolbar **plus** whichever tool modules you want: `WilmaTools.user.js` for course progress, `modules/message-autosaver-chrome-desktop.user.js` for compose autosaving. Toolbar alone does not collect data or autosave drafts.

## Optional message autosaver / Valinnainen viestiluonnosten tallennus

Two standalone Tampermonkey modules are available. **Install only the one appropriate to your browser** (you may have different installations on your phone and computer):

- **Firefox on Android / Firefox Androidissa — EXPERIMENTAL / KOKEELLINEN, only Firefox on Android phones / vain Android-puhelimen Firefoxissa:** [Install userscript](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/message-autosaver-firefox-android.user.js)
- **Chrome on desktop / Chrome tietokoneella — Google Chrome on a computer / tietokoneen Chrome-selain:** [Install userscript](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/message-autosaver-chrome-desktop.user.js)

Firefox Android has a [dedicated information page](https://ljrant.github.io/WilmaTools/firefox-android.html) / [erillinen esittelysivu](https://ljrant.github.io/WilmaTools/firefox-android.html). It is experimental and requires a compatible userscript manager in Firefox on Android, not Chrome Android or Firefox desktop.

Both operate only on `https://*.inschool.fi/messages/compose*` and save the message subject, rich-text body, and recipient snapshot into browser localStorage. They provide manual save, restore, refresh recipients, and clear controls, and offer restoration when the compose form is empty.

**Privacy / Tietosuoja:** Drafts can contain sensitive personal data. localStorage is persistent, unencrypted browser storage, available to scripts running on the same school origin. Use a trusted device/browser profile and click **Clear** after the message is sent. Saving recipients and restoring recipient controls are based on the supplied original script; recipient restoration is not guaranteed to synchronize Wilma's UI state. **Always verify all recipients before sending.** No remote backup or synchronization is provided. The script does **not** automatically delete a saved draft after send.

**Testing status:** Adapted from the supplied Firefox Mobile script. Browser-specific operation and compatibility with varying Wilma implementations have not been verified.

## Drafting messages for flagged grades / Viestit huomioita vaativista arvosanoista

On the gradebook module's **Huomiot / Students with issues** screen, select a single flagged student and open a **separate message template editor** to edit the subject, body and preview. Use **Kopioi viesti ja avaa Wilman viestit / Copy message and open Wilma messages** to copy the draft locally and open the compose page. The template supports `{etunimi}` or `{name}` for the selected student's first name. **No recipients are set and no messages are sent automatically.** The teacher must select the correct recipient and paste/review the draft in Wilma before sending. Only flagged records within the active date and course filters are presented; verify completeness of the gradebook first.

Huomiot-näkymässä voi valita yhden opiskelijan, muokata viestipohjaa ja kopioida viestin avattaessa Wilman viestisivun. Vastaanottaja valitaan itse ja viesti tarkistetaan ennen lähettämistä. Automaattista lähetystä ei tehdä.

## Student selector count / Opiskelijamäärä

Wilma may omit the currently open student from the dropdown links. WilmaTools includes the **current gradebook's student** even if the dropdown only lists classmates. The script attempts to read the current student's name from Wilma's breadcrumb or student selector automatically. If the name cannot be read, it uses a generic current-student label rather than asking for the name. Verify that the total matches your group and that no student is duplicated before using the report.

Wilman opiskelijavalikko ei välttämättä sisällä juuri avoinna olevan opiskelijan omaa linkkiä. WilmaTools lisää nykyisen opiskelijan mukaan. Nimi pyritään lukemaan suoraan Wilman sivun navigaatiosta. Jos nimi ei löydy, käytetään yleistä nykyisen opiskelijan merkintää ilman nimikyselyä. Tarkista ryhmän opiskelijamäärä ja mahdolliset kaksoiskappaleet ennen tulosten käyttöä.

## Features / Ominaisuudet

- FI default; EN available in Settings / Suomi oletuksena, englanti asetuksista
- Interactive per-student grade matrix with fixed-width wrapping course headings
- Grade colors (4–10, P/U/K and other letters)
- Completion-date filter: current August–July school year, other school years, custom dates or all dates
- Hide individual courses, and separate low-grade/issue list (4, 5, 6, U, K)
- CSV export with completion dates
- Modular toggle for course-progress tools; designed for future optional modules

## Privacy / Tietosuoja

The userscript runs in an existing authenticated Wilma session, fetches same-origin pages, and processes student records locally in the browser. Grades and student data are not sent to GitHub or this website. LocalStorage holds **only language/module preferences and hidden course keys**, not gradebook records. Exports contain identifying educational data; store them only in approved locations.

**Caution:** Wilma may add rows dynamically after clicking “Näytä kaikki”. This version parses fetched HTML only. Validate the record count against manually expanded gradebooks before making decisions. Only access students you are authorized to view.

## Website

`index.html` is a static bilingual landing page suitable for GitHub Pages. Enable **Settings → Pages → Deploy from a branch → main / root** if you want it published at `https://ljrant.github.io/WilmaTools/`.

## Development

Files: `modules/desktop-toolbar.user.js` (shared desktop menu), `WilmaTools.user.js` (gradebook Tampermonkey module) and `index.html` (public landing page). Additional browser-specific modules live in `modules/`; they are installed separately. Future tools can be added as independently installed or enabled modules. No student data belongs in this repository.

## Desktop interface / Tietokonekäyttöliittymä

The sidebar is a **separately installed desktop Tampermonkey script** at `modules/desktop-toolbar.user.js`, active on all `*.inschool.fi` pages. It does not by itself activate disabled scripts. / Sivupaneeli on erillinen, kaikilla Wilman sivuilla näkyvä tietokoneen Tampermonkey-skripti. Muut moduulit on otettava käyttöön Tampermonkeyssa.

## Wilma front-page integrations / Wilman etusivun työkalut

Desktop Sidebar **v0.10.0** detects the real **Ohjausryhmäsi** homepage heading and its teacher-specific `/profiles/classes/<id>` link. It places the homeroom link and **Kopioi opiskelijoiden nimet** action in the same box. Names are parsed from student-profile links in the group page using an authenticated same-origin request, deduplicated by student ID, alphabetized, and copied one per line. If student links are not included in the fetched HTML, the tool shows an error rather than inventing data. Under **Ryhmät tässä jaksossa**, the script lists current teaching groups and looks for grading/attendance links on their group pages; dynamically generated links may not be present. The last-visited student gradebook shortcut remains separate from the teacher-specific class page. No unsupported `/students` shortcut is generated.

Tietokoneen työkalupaneeli etsii aloitussivulta oikean **Ohjausryhmäsi**-laatikon ja opettajakohtaisen ryhmälinkin. Opiskelijoiden nimet haetaan ryhmäsivun opiskelijaprofiililinkeistä ja kopioidaan allekkain. **Ryhmät tässä jaksossa** -osiosta voi avata ryhmät ja etsiä sivuilla olevia arviointi- ja tuntimerkintälinkkejä. Toimintojen löytyminen riippuu Wilman ryhmäsivujen todellisesta HTML-rakenteesta.

## Homepage compact group links (Desktop Sidebar v0.11.0)

The **Ryhmät tässä jaksossa** section keeps Wilma's original group-name links. WilmaTools adds just two matching deep links found on the group's own page: URLs ending in `/grading` (**Arviointikirja**) and `/attendance_edit` (**Tuntimerkinnät**). It also adds **Viesti ryhmälle**. No separate *Avaa ryhmä* or *Näytä linkit* button is needed. In **Ohjausryhmäsi**, the original class name remains the main class link; actions are shown compactly without a second heading: grade overview (when a last-used gradebook is known), copy names, message students, message guardians and message both groups.

**Recipient safety:** Message actions only follow existing group-specific Wilma compose links when their labels clearly identify the intended recipient category. The recipient selection is *not* synthesized from student IDs or guessed query parameters. If Wilma does not expose an appropriate link in the fetched group page, the script displays an explanatory notice rather than opening an unaddressed or incorrectly addressed message. To support missing group-message links, inspect the actual Wilma group messaging link or recipient selector and implement/test that specific workflow before enabling direct preselection.

## Homepage homeroom layout (Desktop Sidebar v0.12.0)

The homepage **Ohjausryhmäsi** box is reformatted to emphasize **Arviointinäkymä** followed by **Tuntimerkinnät**. The weekly and summary attendance views are moved under a collapsible **Muut tuntimerkintänäkymät** control. Student-list copy and recipient-safe message actions remain as compact links, without a separate WilmaTools heading. Grade overview now resolves a student gradebook from the teacher's own homeroom profile, not a stale last-viewed student. On the homepage, independently wrapped **Ryhmät tässä jaksossa** is moved above **Ilmoitukset** when both sections share a suitable parent; mismatched page layouts are left unchanged rather than risking unrelated DOM changes. These changes require testing on the actual Wilma front page.

## Unified messaging workflow / Yhtenäinen viestityönkulku (October 2026)

Desktop Sidebar **v0.16.3** adds **Viestipohjat** (editable locally saved message templates) and **Tallennetut viestit** (controls for the independently installed Chrome Desktop autosaver on the Wilma compose page). The existing autosaver script must still be installed and enabled in Tampermonkey; its old floating panel is hidden when the sidebar is active, and the sidebar invokes its save, restore, recipient refresh and clear controls. Templates reside in browser `localStorage` on the school Wilma origin and should not contain student personal details.

Course Progress **v0.16.1** supports checking multiple students in the **Huomiot** view and choosing a saved message template. It copies the prepared message, opens Wilma compose, and shows the student names to be selected **manually**. **No recipient auto-selection or automatic sending is claimed or performed.** Recipient preselection is still a separate task requiring a verified Wilma compose recipient-picker structure. Teachers must verify the recipient list.

On `/profiles/classes/<id>`, the desktop sidebar adds a visually distinct **WilmaTools · Arviointinäkymä** tab when Wilma renders a supported tab bar. This uses the teacher's group to locate a student gradebook, then opens the assessment overlay directly. It is a user-script tab (not a server-side Wilma tab) and depends on class student links being present in the fetched HTML. All changes need live Wilma-browser verification.
