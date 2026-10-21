# WilmaTools

WilmaTools on avoimen lähdekoodin kokoelma Wilman selaintyökaluja. Projekti ei ole Wilman virallinen lisäosa. Käyttöliittymän oletuskieli on suomi.

**Verkkosivu:** https://ljrant.github.io/WilmaTools/

## Asennus

Asenna Tampermonkey ja haluamasi skriptit. Tietokoneella sivupaneeli ja varsinaiset työkalut asennetaan erikseen.

| Työkalu | Versio | Asennus |
| --- | --- | --- |
| WilmaTools-sivupaneeli (tietokone) | 0.20.2 | [Asenna](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/desktop-toolbar.user.js) |
| Ryhmänohjaajan opintoseuranta | 0.20.2 | [Asenna](https://raw.githubusercontent.com/ljrant/WilmaTools/main/WilmaTools.user.js) |
| Viestiluonnosten tallennus – Chrome tietokoneella | 0.12.4 | [Asenna](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/message-autosaver-chrome-desktop.user.js) |
| Viestiluonnosten tallennus – Firefox Androidissa (kokeellinen) | 0.6.0 | [Asenna](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/message-autosaver-firefox-android.user.js) |

Skriptit toimivat erikseen Tampermonkeyn kautta ja niitä voi ottaa käyttöön tai poistaa käytöstä itsenäisesti. Pelkkä sivupaneeli ei kerää suorituksia eikä tallenna viestejä. Skriptien osoiterajaus on `https://*.inschool.fi`.

## Sivupaneeli ja Wilman etusivu

Sivupaneeli tuo WilmaTools-valikon tietokoneen Wilma-sivuille. Valikossa ovat **Arviointinäkymä**, viestin kirjoitus, **Viestipohjat** sekä **Tallennetut viestit**.

Wilman **Ohjausryhmäsi** -laatikossa työkalu näyttää arviointinäkymän, tuntimerkintöjen pikavalinnan ja selvittämättömien merkintöjen ilmaisimen sekä opiskelijalistan kopioinnin. Ryhmän nimi säilyy klikattavana Wilma-linkkinä. Viestitoiminnoissa voi valita opiskelijat, huoltajat tai molemmat **vain, jos Wilman oma ryhmäkohtainen viestilinkki on tunnistettavissa**.

**Ryhmät tässä jaksossa** -laatikkoon lisätään Wilman alkuperäisten toimintokuvakkeiden yhteyteen neljäs, kirjekuoren kuvaa käyttävä **Viesti ryhmälle** -toiminto. Alkuperäisiä arviointi- ja tuntimerkintälinkkejä ei korvata. Laatikon sisältöä ei muotoilla erilliseksi linkkilistaksi. Ryhmä- ja ilmoituslaatikoiden keskinäinen järjestys voidaan vaihtaa, jos sivun rakenne sallii sen.

Ryhmäsivulle lisätään erottuva **WilmaTools · Arviointinäkymä** -välilehti, jos Wilman sivulla on tuettu välilehtipalkki. Tiedonkeruu käynnistyy ensimmäisellä avauskerralla ja näkymä säilyy samalla ryhmäsivulla. Ominaisuuksien toimivuus on tarkistettava oman koulun Wilma-versiossa.

## Ryhmänohjaajan opintoseuranta

Avaa ohjausryhmän sivu (`/profiles/classes/<ryhmätunniste>`) ja valitse **WilmaTools · Arviointinäkymä** -välilehti. Arviointityökalu ei enää käynnisty opiskelijan suoritussivulla.

Työkalu **löytää opiskelijoita automaattisesti** Wilman valikosta, hakee heidän suoritussivunsa saman palvelimen sisältä ja yhdistää tiedot yhteiseen taulukkoon. Opiskelijoita ei siis syötetä yksitellen. **Versiossa 0.18.0 opiskelijaluettelo haetaan suoraan avoinna olevalta ryhmäsivulta.** Jos ryhmäsivulta ei löydy opiskelijalinkkejä, näytetään virhe eikä käytetä toisen ryhmän opiskelijavalikkoa. Suoritussivut haetaan edelleen opiskelijakohtaisesti, mutta ilman keinotekoista viivettä, enintään viisi rinnakkaista pyyntöä kerrallaan. Keräyksen yhteenvedossa näkyvät opiskelijamäärä sekä onnistuneet, tyhjät ja epäonnistuneet haut. Avoinna oleva opiskelija yritetään ottaa mukaan, vaikka häntä ei olisi pudotusvalikossa. Tämä tiedonkeruu tapahtuu edelleen opiskelijasivu kerrallaan. Suoraan ryhmätasolta tapahtuvaa arvosanojen hakua ei ole vielä toteutettu, sillä luotettavaa ryhmäkohtaista tietolähdettä ei ole vahvistettu.

Ominaisuudet:
- Värikoodattu opintojaksomatriisi ja arvosanat.
- Lukuvuosisuodatus (elokuu–heinäkuu), oma aikaväli ja päivämäärärajaus.
- Kurssien piilotus ja CSV-vienti.
- **Huomiot** arvosanoille 4, 5, 6, U ja K.
- Usean opiskelijan valinta huoli- tai seurantaviestin valmisteluun.

**Tarkista ryhmän opiskelijamäärä ja suoritustietojen kattavuus.** Wilma saattaa ladata lisää rivejä vasta ”Näytä kaikki” -toiminnolla; niitä ei välttämättä löydy haetusta HTML:stä.

## Viestipohjat ja viestiluonnokset

Sivupaneelin **Viestipohjat**-työkalussa voi luoda, muokata ja poistaa pohjia sekä tallentaa ne selaimen paikalliseen muistiin. Huomiot-näkymässä voi valita opiskelijoita ja viestipohjan. Toiminto kopioi viestin ja avaa Wilman kirjoitussivun.

**Huomiot-näkymän vastaanottajia ei vielä esivalita eikä viestejä lähetetä automaattisesti.** Opettajan on valittava ja tarkistettava vastaanottajat Wilmassa. Myös etusivun ryhmäviestipainikkeet edellyttävät Wilman omaa, vastaanottajat tunnistavaa viestilinkkiä; jos sitä ei löydy, toiminto ilmoittaa rajoituksesta.

Chrome-tietokoneversion automaattitallennin säilyttää viestin aiheen, sisällön ja vastaanottajatiedot paikallisesti `localStorage`-muistissa. Sivupaneelin **Tallennetut viestit** -kohdassa voi kirjoitussivulla käyttää tallennus-, palautus-, vastaanottajien päivitys- ja poistotoimintoja. Automaattitallennin on asennettava erikseen.

Firefox Android -versio on **kokeellinen**, toimii vain Androidin Firefox-selaimessa ja tarvitsee yhteensopivan käyttäjäskriptilaajennuksen. Katso [erilliset ohjeet](https://ljrant.github.io/WilmaTools/firefox-android.html).

## Tietosuoja ja käyttövastuu

Opintoseurannan opiskelija- ja arvosanatiedot käsitellään kirjautuneessa selainistunnossa. Niitä ei lähetetä GitHubiin tai WilmaToolsin verkkosivustolle. Kieliasetuksia, piilotettuja opintojaksoja ja viestipohjia voidaan säilyttää paikallisesti selaimessa.

**Viestiluonnokset tallentuvat pysyvästi ja salaamattomasti selaimen localStorage-muistiin.** Niissä voi olla arkaluonteisia tietoja. Tyhjennä tallenteet käytön jälkeen ja tarkista vastaanottajat aina ennen lähettämistä. Lähetetty viesti ei välttämättä poista paikallista luonnosta automaattisesti. CSV-viennit sisältävät opiskelijatietoja, joita tulee käsitellä organisaation ohjeiden mukaan.

Käytä vain sellaisia opiskelijatietoja, joiden käsittelyyn sinulla on oikeus.

## Lähdekoodi ja kehitys

- `WilmaTools.user.js` – opintoseuranta
- `modules/desktop-toolbar.user.js` – yhtenäinen sivupaneeli
- `modules/message-autosaver-chrome-desktop.user.js` – Chrome-tietokoneversion viestiluonnosten tallennus
- `modules/message-autosaver-firefox-android.user.js` – kokeellinen Firefox Android -versio
- `index.html` ja `firefox-android.html` – GitHub Pages -sivut

Lähdekoodi: https://github.com/ljrant/WilmaTools

**Huomautus:** Kaikkia toimintoja ei ole vielä vahvistettu eri koulujen Wilma-käyttöliittymissä. Testaa etenkin ryhmäsivun linkit, opiskelijamäärä ja vastaanottajavalinta ennen varsinaista käyttöä.

## Arviointinäkymän integrointi (v0.20.2)

Ryhmäsivulle lisätään **Arviointinäkymä** Wilman omaan välilehtiriviin mahdollisuuksien mukaan **Tuen tilastot** -välilehden jälkeen. Arviointitaulukko näkyy samalla sivulla; muihin välilehtiin siirtyminen palauttaa Wilman alkuperäisen sisällön. Sivupaneelista poistettiin erillinen arviointipikavalinta. Opiskelijoiden suoritussivujen haussa ei ole keinotekoista odotusta: käytössä on enintään viisi rinnakkaista pyyntöä. Käyttöliittymäintegraatio on testattava koulun Wilma-versiossa.

Arviointinäkymän versiossa **0.18.3** näkymä korvaa ryhmäsivun välilehtialueen muun sisällön sen sijaan, että se lisättäisiin sivun loppuun. Wilman alkuperäinen välilehtisisältö palautetaan muihin välilehtiin siirryttäessä. Käyttöliittymää on testattava oikeassa Wilma-ympäristössä.

**v0.20.2:** Arviointinäkymä-välilehti lisätään myös ryhmän alisivuille, jos niillä näkyy sama Wilman välilehtipalkki. Alisivun välilehtilinkki avaa saman ryhmän pääsivun arviointinäkymän automaattisesti.

**v0.20.2:** Opiskelijoiden suoritukset ladataan taustalla enintään viidellä rinnakkaisella pyynnöllä. Arviointimatriisi näytetään yhdellä kertaa valmistumisen jälkeen. Erillisiä keräys-, pysäytys- ja päivityspainikkeita tai lataus- ja virhelaskureita ei näytetä. Puuttuvia tietoja ei kuitenkaan korvata oletusarvoilla.

**v0.20.2:** Ryhmäsivun välilehtirivillä ovat erilliset **Arviointinäkymä** ja **Huomiot**. Arviointinäkymän sisäiset päällekkäiset navigointi- ja keräyspainikkeet on poistettu. Matriisin **Opiskelija**-otsaketta painamalla voi järjestää opiskelijat aakkosittain nousevaan tai laskevaan järjestykseen. Lukuvuosi- ja muut suodattimet sekä CSV-vienti säilyvät.

**Sivupaneeli v0.17.2:** WilmaTools-valikon avauspainike sijoitetaan Wilman tummansinisen otsakealueen oikeaan reunaan, mahdollisuuksien mukaan käyttäjä- ja koulutietojen sekä **Lähetä tapahtumakutsuja** -linkin alapuolelle. Painike pysyy paikallaan sivua vieritettäessä. Varsinainen työkalupaneeli avautuu edelleen painikkeesta.

## Viestikirjasto – Chrome v0.9.2

Wilman viestin kirjoitussivulla näkyvä **Viestikirjasto** avaa luonnoshistorian ja viestipohjat sisältävän sivupalkin. Tallennin toimii hiljaisesti: ei automaattisia palautuskyselyitä eikä näkyviä tallennusilmoituksia. Luonnoksia tallennetaan selaimen paikalliseen muistiin ja enintään 35 tuoretta versiota säilytetään; lyhyen ajan sisällä tapahtuneita muutoksia yhdistetään.

**Viestipohjat** tukevat nimeä, vapaavalintaista kategoriaa, aihetta, sisältöä ja valinnaista vastaanottajien tilannekuvaa. Palautus yrittää käyttää Wilman omaa vastaanottajavalitsinta ja tarkistaa piilotettujen vastaanottajakenttien vastaavuuden. Vastaanottajien oikeellisuutta ei voida taata: tarkista ne Wilmassa aina ennen lähettämistä. Tallennettua HTML:ää ei sijoiteta suoraan vastaanottajakenttiin.

**Huomiot**-välilehden valmistellut viestit siirtyvät samaan viestikirjastoon. Valitut opiskelijat näytetään tarkistuslistana, mutta heitä ei aseteta automaattisesti viestin vastaanottajiksi. Tallenteet ja viestipohjat ovat tämän Wilma-palvelimen selaimen salaamattomassa localStorage-muistissa, eivät palvelinvarmistettuja Wilma-luonnoksia.

## Jaettava viestipohjaformaatti – WMT TXT v1

Chrome-viestikirjaston **Viestipohjat**-välilehdeltä voi tuoda UTF-8-muotoisen `.wmt.txt`-tiedoston sekä viedä kaikki tai erikseen valitut viestipohjat. Tiedoston tunniste on `# WilmaTools Templates v1`. Kukin pohja alkaa rivillä `[POHJA]`, sisältää otsaketiedot `id`, `nimi`, `kategoria`, `vastaanottajat` ja `aihe`, ja otsakkeiden jälkeisen tyhjän rivin jälkeen varsinaisen viestitekstin; sulkumerkki on `[/POHJA]` omalla rivillään. Viestissä voi käyttää `{paivamaara}`-muuttujaa ja muita `{muuttuja}`-merkintöjä, jotka käyttäjä täyttää pohjaa käytettäessä. Merkintöjen `[/POHJA]` ja `[POHJA]` käyttöä kirjaimellisesti viestitekstin yksittäisenä rivinä tulee välttää.

Vientitiedostoon sisällytetään **vain viestipohjat**, ei automaattitallennettuja luonnoksia tai niiden vastaanottajien henkilökohtaisia tilannekuvia. Viestitekstissä voi silti olla henkilötietoja: tarkista vietävät pohjat ennen jakamista.

**Huomiot**-välilehdeltä viestimoottori siirtää valitut opiskelijat sekä viestin aiheen ja tekstin kirjoituslomakkeeseen, yrittää valita opiskelijat Wilman vastaanottajavalitsimesta täsmäävien nimien perusteella ja ilmoittaa kirjastossa, jos joitakin valintoja ei voitu vahvistaa. WilmaToolsin mukana siirtyvät myös opiskelijoiden tunnisteet tulevaa tarkempaa valintaa varten. **Nykyinen vastaanottajien automaattivalinta perustuu nimeen eikä sitä ole vahvistettu Wilman eri käyttöliittymissä.** Tarkista aina vastaanottajat ennen viestin lähettämistä; ohjelma ei lähetä viestiä automaattisesti.

### Yhdistetyt vastaanottajat

Viestipohjan vastaanottajatavaksi voi valita **Ryhmiä ja yksittäisiä henkilöitä** (`yhdistelma`). Erillisiin kenttiin kirjoitetaan yksi ryhmä tai luokka sekä yksi henkilö per rivi. `.wmt.txt`-tiedoston otsaketietoihin tallentuvat `ryhmat: 26G` ja `henkilot: Etunimi Sukunimi; Toinen Opettaja`. Viestimoottori yrittää valita sekä ryhmät että yksittäiset henkilöt Wilman vastaanottajavalitsimesta. Täsmäämättömät valinnat näytetään käyttäjälle. Ryhmän jäsenten nimiä ei lisätä henkilökohtaisten tekstimuuttujien arvoiksi; yhteisviestissä ei voi käyttää `{etunimi}`-muuttujaa. Ryhmien ja henkilöiden automaattivalinta on kokeellinen ja vastaanottajat tulee tarkistaa Wilmassa ennen lähettämistä. Huomaa, että jaettu viestipohja sisältää siihen kirjoitetut henkilöiden nimet.

**Sivupaneeli v0.18.1:** Etusivun Viesti opiskelijoille / huoltajille / molemmille -toiminto hyväksyy vain yksiselitteisen ryhmäkohtaisen Wilman viestilinkin. Opiskelijarivin yksittäisen henkilön viestilinkkiä ei enää käytetä ryhmän sijasta. Ellei oikeaa ryhmälinkkiä löydy, toiminto näyttää ilmoituksen eikä avaa väärille vastaanottajille osoitettua viestiä. Ryhmäkohtaisten vastaanottajalinkkien tunnistus vaatii Wilman oikean HTML-rakenteen varmistamisen.

**Vastaanottajavalinta (sivupaneeli v0.20.2, viestimoottori v0.12.4):** Wilman luokan vastaanottajapaneelista tunnistettiin opiskelija- ja huoltajaryhmien `button.recipient-block`-elementit. Etusivun ryhmäkohtaiset opiskelijoille, huoltajille ja molemmille tarkoitetut viestitoiminnot siirtävät luokan tunnisteen viestimoottorille, joka avaa vastaavan paneelin ja käyttää Wilman omia painikkeita. Valmiiksi aktiivisia (`aria-pressed=true`) vastaanottajia ei napsauteta toistamiseen. Yhdistelmäviestipohjissa luokan ryhmävalinta käyttää samaa mekanismia, mutta yksittäisten opettajien nimihaku on vielä kokeellinen. Vastaanottajavalinnat tulee vahvistaa Wilmassa ennen viestin lähettämistä.

### Viestipohjan lisäasetukset ja ajastus (v0.12.4)

Viestipohjan muokkausnäkymässä voi määrittää Wilman valinnat **vastaanottajat näkevät toistensa nimet**, **vastaanottajat näkevät toistensa vastaukset**, **lähetä myös tekstiviestinä**, **lähetä myös sähköpostina** ja **ajasta lähetys**. Jokaisella on vaihtoehdot *Säilytä Wilman oletus*, *Kyllä* ja *Ei*. Ajastukseen voi antaa lisäksi päivän ja ajan Wilman kenttien hyväksymässä muodossa. Tekstiformaatissa vastaavat kentät ovat `nayta_vastaanottajien_nimet`, `nayta_vastaukset`, `tekstiviesti`, `sahkoposti`, `ajastus`, `lahetyspaiva` ja `lahetysaika`. Tyhjä arvo jättää Wilman oletuksen ennalleen, `true` valitsee ja `false` poistaa valinnan. Käyttöliittymässä pois käytöstä olevaan kenttään ei kosketa. Ajastuksen oikeellisuus ja mahdolliset sähköposti-/tekstiviestipalvelun asetukset tulee tarkistaa Wilmassa ennen lähetystä.

## Käyttöliittymän sijoittelu (sivupaneeli v0.20.2, viestikirjasto v0.12.4)

Aiempi koko sivun päälle avautuva WilmaTools-sivupaneeli on korvattu matalalla, vaakasuuntaisella alareunan työkalurivillä. Riviltä pääsee viestin kirjoittamiseen, viestipohjiin ja luonnoksiin. Wilman viestin kirjoitussivulla **Viestikirjasto** sijaitsee nyt varsinaisessa sivusisällössä kirjoituslomakkeen yhteydessä, ei kiinteänä oikean reunan peittävänä paneelina. Kirjaston luonnokset ja viestipohjat sekä niiden tuonti, vienti ja muokkaus ovat muuten edelleen käytettävissä. Sijoittelu tulee tarkistaa Wilman omassa sivuasettelussa.

## Lähetetystä viestistä viestipohjaksi (v0.20.2 + v0.12.4)

Wilman avatun viestin sivulle lisätään **Tallenna viestipohjaksi** -painike, kun viestin sisältö löytyy sivun `iframe#message-wrapper`-kehyksen `div.ckeditor`-elementistä. Painike siirtää luettavan viestitekstin ja sivun otsikosta päätellyn aiheen Wilman kirjoitussivun Viestikirjaston muokkausnäkymään. Varmista aihe, tarkista ja poista mahdolliset henkilötiedot, määritä kategoria ja muuttujat sekä tallenna pohja itse. Alkuperäisiä vastaanottajia ei tuoda pohjaan. Alkuperäisen viestin tekstimuotoilut eivät välttämättä säily, sillä kopioidaan viestin luettava teksti. Käyttö vaatii sekä työkalurivimoduulin että Chrome-viestikirjaston asennuksen.

### Viestin toimintovalikon WilmaTools-painike (v0.20.2)

Avatun Wilma-viestin näkymässä WilmaToolsin toiminnot ovat omassa pienessä **WilmaTools ▾** -pudotusvalikossa viestin toimintopainikkeiden vieressä silloin, kun Wilman oma toimintovalikko löytyy. Valikko sisältää **Tallenna viestipohjaksi**, **Viestipohjat**, **Luonnokset** ja **Viestikirjasto**. Jos Wilman toimintopainikkeita ei tunnisteta, painike näytetään viestikehyksen yläpuolella. Wilman omia toimintovalintoja ei muuteta. Erillinen suuri kelluva sivupaneeli ei palaudu.

## Yhteinen viestisivujen WilmaTools-rivi (v0.20.2 + v0.12.4)

DOM-raporttien perusteella sekä viestin kirjoitusnäkymässä että yksittäisen viestin näkymässä on `main#main-content`. Molemmissa näkyy nyt sama huomaamaton WilmaTools-työkalurivi tämän elementin alussa. Aiempi erillinen viestikohtainen pudotusvalikko ja näiden sivujen alareunan yleisrivi poistuvat näkyvistä. Kirjoitusnäkymän **Viestipohjat**, **Luonnokset** ja **Tallenna nykyinen pohjaksi** käyttävät upotettua kirjastoa. Yksittäisen viestin näkymässä **Tallenna viestipohjaksi** poimii viestikehyksen tekstin ja avaa muokattavan pohjan kirjoitussivulla; muut kirjastolinkit vievät samaan kirjoitussivun kirjastoon. Lähetystä ei automatisoida. Lopullinen sijoittelu tulee testata Wilman oikeassa käyttöliittymässä.

## Viestikirjasto ja vastaanottajaluonnokset (v0.20.2 + v0.12.4)

- Etusivun ryhmäviestien opiskelija-/huoltajavastaanottajat avataan Wilman alkuperäisillä `r_class`- ja `r_classguardian`-parametreilla.
- Luonnoksessa tallennetaan luokan URL-pohjainen vastaanottajavalinta, jos se on saatavilla, ja palautuksessa avataan Wilman oma vastaanottajilla esitäytetty kirjoitusosoite. Henkilökohtaiset vastaanottajat voivat edelleen vaatia käsin tarkistamista.
- Viestikirjasto sijoitetaan kirjoituslomakkeen oikealle puolelle joustavana rinnakkaisena laatikkona; kapealla ikkunalla laatikot pinoutuvat.
- Viestipohjalla voi olla useita kategorioita puolipisteellä erotettuina, ja luokkasuodatus löytää pohjan jokaisesta sen kategoriasta.
- `.wmt.txt` sisältää valinnaisen URL-koodatun `sisalto_html`-kentän muotoilun säilyttämistä varten. Viestipohjan sisältöä voi muokata visuaalisesti muotoiltuna. Vanhojen pohjien tuonti säilyy, ja myös alaviivan sisältävät asetuskentät parsitaan.
- Lähetetyn viestin pohjaksi tallennus siirtää myös muotoillun viestitekstin. Tarkista henkilökohtaiset tiedot ennen pohjan tallentamista ja jakamista.

## Viestien välilehdet (työkalurivi v0.21.0 ja Viestikirjasto v0.13.1)

Wilman viestisivun yläreunassa on yhteinen välilehtivalikko **Viesti**, **Viestipohjat** ja **Luonnokset**. Kirjoitussivulla välilehdet avaavat oikeanpuoleisen Viestikirjaston vastaavan osion; kirjaston omat päällekkäiset luonnos- ja viestipohjapainikkeet poistettiin. Viestikirjasto voidaan sulkea ilman viestin lähettämistä. Yksittäisten vastaanottajien automaattinen palautus ja siihen liittyvä vahvistusilmoitus on poistettu käytöstä. Luokan vastaanottajat valitaan edelleen Wilman natiivien ryhmäparametrien kautta, kun tieto on saatavilla. Yksittäiset vastaanottajat käsitellään Wilmassa käsin.

### Luonnosten tiivis valinta ja vastaanottajien palautus (Viestikirjasto v0.13.3)

Luonnokset-välilehdessä on yksi valintaluettelo, josta valittu automaattitallenne tai historialuonnos avataan suoraan viestieditoriin. Otsikko, muotoiltu viestiteksti ja vastaanottajat pyritään palauttamaan oletuksena. Vastaanottajien palautus ei edellytä erillistä hyväksyntää eikä piilotettujen Wilma-kenttien täsmävertailun onnistumista. Kokonaisten luokkien vastaanottajat palautetaan ensisijaisesti Wilman natiivien URL-parametrien avulla. Yksittäisten henkilöiden palautus käyttää Wilman vastaanottajavalitsinta parhaansa mukaan, eikä sen onnistumista voida taata kaikissa tilanteissa.

### Viestipohjien haku ja käyttö (viestikirjasto v0.14.0)

**Viestipohjat**-välilehdessä on hakukenttä, kategoriasuodatin ja kategorioittain ryhmitelty pudotusvalikko (`optgroup`). Viestipohjan valitseminen käyttää sitä suoraan Wilman viestin kirjoituslomakkeeseen. Muokkaus, vienti, tuonti ja poisto löytyvät suljettavasta **Viestipohjien hallinta** -osiosta, jotta selausnäkymä pysyy kompaktina. CKEditor 4:n viestisisällön syöttö käyttää `setData(html, callback)` -kutsua ja oikeaa HTML-tunnistusta. Toiminta tulee vielä varmistaa oikeassa Wilma-istunnossa.

### CKEditorin oikea palautuspolku (Viestikirjasto v0.14.1)

Luonnosten ja viestipohjien sisältö palautetaan **vain CKEditorin `setData`-rajapinnan kautta**. Aiempi iframe-elementin `innerHTML`-varapolku saattoi näyttää tekstin oikein mutta jättää editorin oman tilan päivittämättä, jolloin tekstiä ei voinut muokata tai lähettää oikein. Jos editori ei ole vielä valmis, palautus odottaa valmistumista enintään 15 sekuntia ja ilmoittaa virheestä sen sijaan, että muuttaisi pelkkää näkyvää HTML:ää. Viestin vastaanottajien palautus pysyy erillisenä toimintona.

### Rinnakkainen Viestikirjasto ja editorin täyttö (v0.15.1)

Wilman kirjoituslomake ja Viestikirjasto sijoitetaan vierekkäisiin sarakkeisiin, kun tilaa on riittävästi; kapealla näytöllä kirjasto tulee alle. Yhteinen **Viesti / Viestipohjat / Luonnokset** -välilehtirivi sijoittuu Viestikirjaston yläosaan. Viestikirjasto alustetaan viestin kirjoitussivun yhteyteen eikä kellu Wilman sisältöjen päällä. Viestipohjien ja luonnosten tekstin palautus tapahtuu vain editorin omalla CKEditor 4 `setData()` -rajapinnalla: piilotettua HTML-kenttää tai iframe-elementin sisältöä ei muuteta käsin, jottei Wilman editorin muokattava tila rikkoudu. Toimivuus on vielä testattava Wilman varsinaisessa käyttöliittymässä.

### CKEditorin iframe-korjaus (Viestikirjasto v0.15.3)

Rinnakkaisen asettelun aiemmassa toteutuksessa Wilman viestilomake siirrettiin toiseen DOM-säiliöön. Tämä saattoi irrottaa CKEditorin iframe-dokumentin ja aiheuttaa `getSelection`-virheen sekä estää palautettujen viestien muokkaamisen tai tallentamisen. Uusi asettelu käyttää alkuperäisen lomakkeen vanhempielementin CSS-ruudukkoa eikä siirrä viestilomaketta tai editoria DOM-puussa. Päivityksen jälkeen sivu on ladattava uudelleen, jotta jo rikkoutunut editori alustuu uudelleen.
