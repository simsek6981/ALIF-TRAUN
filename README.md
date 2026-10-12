# ALIF Traun - Namaz Vakitleri

Responsive Gebetszeitenanzeige f�r Handy, Tablet und Moschee-Bildschirm. Die Seite bleibt eine statische Webseite und funktioniert auf GitHub Pages ohne Build, API-Schl�ssel oder kostenpflichtigen Dienst.

## Gebetszeiten

Die Anzeige verwendet **Linz**, passend zur gew�nschten Originalseite:

https://namazvakitleri.com.tr/sehir/1480/linz-namaz-vakitleri

Die Originalseite bezieht ihre Diyanet-Daten aus `https://nv-api.com/getTimes/1480`. Diese Seite liest denselben Endpunkt und �bernimmt `imsak`, `gunes`, `ogle`, `ikindi`, `aksam` und `yatsi` **unver�ndert**. Keine eigenen Berechnungen, keine Minutenaufschl�ge und keine Traun-Koordinaten.

- Neue Daten beim �ffnen, danach alle 15 Minuten, beim Tageswechsel und nach Wiederherstellung der Verbindung.
- Uhrzeit, Kalender und Countdown verwenden immer `Europe/Vienna`, auch auf Ger�ten in einer anderen Zeitzone.
- Heute bleibt bis Mitternacht sichtbar. Nach Yats� l�uft der Countdown bis zum tats�chlichen Imsak des n�chsten Tages. G�nes ist Sonnenaufgang und wird nicht als sechstes Gebet gez�hlt.
- Validierte Quellendaten werden lokal im Browser gespeichert. Bei einem Ausfall werden nur vorhandene, datumsgenaue Zeiten angezeigt und deutlich als gespeichert gekennzeichnet.
- `data/linz.json` enth�lt zus�tzlich einen unver�nderten Quellenschnappschuss vom 12.10.2026. Dieser ist ein zeitlich begrenzter Start-Fallback; die automatische laufende Aktualisierung erfolgt direkt �ber die Original-API. Wenn weder Quelle noch gespeicherte Daten den aktuellen Tag enthalten, zeigt die Seite keine gesch�tzten oder veralteten Uhrzeiten.
- Die Abh�ngigkeit von einem externen Dienst bleibt bestehen. Sollte der Anbieter den Endpunkt �ndern oder entfernen, muss die Integration angepasst werden. Einstellungen zu einer anderen Berechnungsmethode oder pers�nliche Minutenkorrekturen auf der Originalseite sind nicht Bestandteil des Diyanet-Standardabgleichs.

## Anzeige

T�rkische Bezeichnungen mit deutschen Erl�uterungen, sechs Karten nebeneinander auf gro�en Querformat-Bildschirmen, eine Liste auf gro�en Hochformat-Bildschirmen und zwei Spalten auf dem Handy. Vollbild und Hell-/Dunkelmodus stehen oben rechts bereit. Der Kalender enth�lt die aktuell von der Quelle verf�gbaren Tage.

## GitHub Pages

`index.html`, `styles.css`, `prayer-core.js`, `app.js`, `data/` und das bestehende Logo gemeinsam im ver�ffentlichten Verzeichnis belassen. Bestehende Pages-Ver�ffentlichung aus `main` und `/ (root)` kann unver�ndert weiterverwendet werden. Es gibt keine zus�tzliche Hosting-Plattform.

## Lokal pr�fen

```sh
python -m http.server 8000
node --test tests/prayer-core.test.cjs
```

Dann `http://localhost:8000` �ffnen. Die Tests pr�fen Quellentreue, fehlerhafte Daten, Gebetswechsel, Tageswechsel und beide Sommer-/Winterzeitwechsel. GitHub Actions pr�ft zus�tzlich die Browserdarstellung, die Live-Datenquelle und die �bereinstimmung mit der Originalseite.
