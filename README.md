# WilmaTools

WilmaTools on avoimen lähdekoodin kokoelma Wilman selaintyökaluja. Projekti ei ole Wilman virallinen lisäosa. Käyttöliittymän oletuskieli on suomi.

**Verkkosivu:** https://ljrant.github.io/WilmaTools/

## Asennus

Asenna Tampermonkey ja haluamasi skriptit. Tietokoneella sivupaneeli ja varsinaiset työkalut asennetaan erikseen.

| Työkalu | Versio | Asennus |
| --- | --- | --- |
| WilmaTools-sivupaneeli (tietokone) | 0.18.0 | [Asenna](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/desktop-toolbar.user.js) |
| Ryhmänohjaajan opintoseuranta | 0.19.2 | [Asenna](https://raw.githubusercontent.com/ljrant/WilmaTools/main/WilmaTools.user.js) |
| Viestiluonnosten tallennus – Chrome tietokoneella | 0.9.2 | [Asenna](https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/message-autosaver-chrome-desktop.user.js) |
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

## Arviointinäkymän integrointi (v0.19.0)

Ryhmäsivulle lisätään **Arviointinäkymä** Wilman omaan välilehtiriviin mahdollisuuksien mukaan **Tuen tilastot** -välilehden jälkeen. Arviointitaulukko näkyy samalla sivulla; muihin välilehtiin siirtyminen palauttaa Wilman alkuperäisen sisällön. Sivupaneelista poistettiin erillinen arviointipikavalinta. Opiskelijoiden suoritussivujen haussa ei ole keinotekoista odotusta: käytössä on enintään viisi rinnakkaista pyyntöä. Käyttöliittymäintegraatio on testattava koulun Wilma-versiossa.

Arviointinäkymän versiossa **0.18.3** näkymä korvaa ryhmäsivun välilehtialueen muun sisällön sen sijaan, että se lisättäisiin sivun loppuun. Wilman alkuperäinen välilehtisisältö palautetaan muihin välilehtiin siirryttäessä. Käyttöliittymää on testattava oikeassa Wilma-ympäristössä.

**v0.19.0:** Arviointinäkymä-välilehti lisätään myös ryhmän alisivuille, jos niillä näkyy sama Wilman välilehtipalkki. Alisivun välilehtilinkki avaa saman ryhmän pääsivun arviointinäkymän automaattisesti.

**v0.19.0:** Opiskelijoiden suoritukset ladataan taustalla enintään viidellä rinnakkaisella pyynnöllä. Arviointimatriisi näytetään yhdellä kertaa valmistumisen jälkeen. Erillisiä keräys-, pysäytys- ja päivityspainikkeita tai lataus- ja virhelaskureita ei näytetä. Puuttuvia tietoja ei kuitenkaan korvata oletusarvoilla.

**v0.19.0:** Ryhmäsivun välilehtirivillä ovat erilliset **Arviointinäkymä** ja **Huomiot**. Arviointinäkymän sisäiset päällekkäiset navigointi- ja keräyspainikkeet on poistettu. Matriisin **Opiskelija**-otsaketta painamalla voi järjestää opiskelijat aakkosittain nousevaan tai laskevaan järjestykseen. Lukuvuosi- ja muut suodattimet sekä CSV-vienti säilyvät.

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
