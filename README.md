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

## Optional message autosaver / Valinnainen viestiluonnosten tallennus

Two standalone Tampermonkey modules are available. **Install only the one appropriate to your browser** (you may have different installations on your phone and computer):

- **Firefox on Android / Firefox Androidissa:** [Install userscript](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/message-autosaver-firefox-android.user.js)
- **Chrome on desktop / Chrome tietokoneella:** [Install userscript](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/message-autosaver-chrome-desktop.user.js)

Both operate only on `https://*.inschool.fi/messages/compose*` and save the message subject, rich-text body, and recipient snapshot into browser localStorage. They provide manual save, restore, refresh recipients, and clear controls, and offer restoration when the compose form is empty.

**Privacy / Tietosuoja:** Drafts can contain sensitive personal data. localStorage is persistent, unencrypted browser storage, available to scripts running on the same school origin. Use a trusted device/browser profile and click **Clear** after the message is sent. Saving recipients and restoring recipient controls are based on the supplied original script; recipient restoration is not guaranteed to synchronize Wilma's UI state. **Always verify all recipients before sending.** No remote backup or synchronization is provided. The script does **not** automatically delete a saved draft after send.

**Testing status:** Adapted from the supplied Firefox Mobile script. Browser-specific operation and compatibility with varying Wilma implementations have not been verified.

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

Files: `WilmaTools.user.js` (Tampermonkey) and `index.html` (public landing page). Additional browser-specific modules live in `modules/`; they are installed separately. Future tools can be added as independently installed or enabled modules. No student data belongs in this repository.
