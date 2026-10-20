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

Files: `WilmaTools.user.js` (Tampermonkey) and `index.html` (public landing page). Future tools can be added as individually enabled modules. No student data belongs in this repository.
