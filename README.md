# ALIF Traun – Namaz Vakitleri

Responsive Gebetszeitenanzeige für Handy, Tablet und Moschee-Bildschirm. Die Seite bleibt eine statische Webseite und funktioniert auf GitHub Pages ohne Build, API-Schlüssel oder kostenpflichtigen Dienst.

## Gebetszeiten

Die Anzeige verwendet **Linz**, passend zur gewünschten Originalseite:

https://namazvakitleri.com.tr/sehir/1480/linz-namaz-vakitleri

Die Originalseite bezieht ihre Diyanet-Daten aus `https://nv-api.com/getTimes/1480`. GitHub Actions liest denselben Endpunkt und übernimmt `imsak`, `gunes`, `ogle`, `ikindi`, `aksam` und `yatsi` **unverändert**. Keine eigenen Berechnungen, keine Minutenaufschläge und keine Traun-Koordinaten.

Der Anbieter blockiert Browseranfragen anderer Webseiten per CORS. Deshalb aktualisiert der Workflow **Update Linz prayer times** stündlich den separaten Branch `prayer-data`. Die Webseite liest dessen öffentliches `data/linz.json` über `raw.githubusercontent.com`. Die veröffentlichte Seite und ihre Pages-Konfiguration müssen für Datenaktualisierungen nicht neu gebaut werden. Keine fremden CORS-Proxys oder zusätzlichen Zugangsdaten.

- Die Quelle wird stündlich um Minute 17 abgerufen; die Webseite liest die Daten beim Öffnen, danach alle 15 Minuten, beim Tageswechsel und nach Wiederherstellung der Verbindung. Der tatsächliche Quellenstand wird in der Anzeige genannt. GitHub kann geplante Läufe verzögern; eine sofortige Übernahme kurzfristiger Änderungen beim Anbieter ist daher nicht garantiert.
- Uhrzeit, Kalender und Countdown verwenden immer `Europe/Vienna`, auch auf Geräten in einer anderen Zeitzone.
- Heute bleibt bis Mitternacht sichtbar. Nach Yatsı läuft der Countdown bis zum tatsächlichen İmsak des nächsten Tages. Güneş ist Sonnenaufgang und wird nicht als sechstes Gebet gezählt.
- Validierte Quellendaten werden lokal im Browser gespeichert. Bei einem Ausfall werden nur vorhandene, datumsgenaue Zeiten angezeigt und deutlich als gespeichert gekennzeichnet.
- `data/linz.json` auf `main` enthält zusätzlich einen unveränderten Quellenschnappschuss vom 12.10.2026. Dieser ist ein zeitlich begrenzter Start-Fallback; die laufenden Daten kommen aus dem automatisch aktualisierten Branch `prayer-data`. Wenn weder Quelle noch gespeicherte Daten den aktuellen Tag enthalten, zeigt die Seite keine geschätzten oder veralteten Uhrzeiten.
- Die Abhängigkeit von einem externen Dienst bleibt bestehen. Sollte der Anbieter den Endpunkt ändern oder entfernen, muss die Integration angepasst werden. Einstellungen zu einer anderen Berechnungsmethode oder persönliche Minutenkorrekturen auf der Originalseite sind nicht Bestandteil des Diyanet-Standardabgleichs.

## Anzeige

Sechs große Zeilen mit Namen links und sehr großen, gleichmäßig dunklen Uhrzeiten rechts. Ausschließlich heller Modus: weißer Hintergrund, dunkelblaue Schrift und eine zurückhaltende blaue Markierung für das nächste Gebet. Das Original-Logo bleibt unverändert und wird im natürlichen Seitenverhältnis 5:1 gezeigt.

Das gesamte Display passt im normalen Betrieb in die Browserhöhe. Die Uhr und der Countdown stehen außerhalb der sechs Zeilen und sind deutlich kleiner. Sekunden sind zusätzlich verkleinert. Der Kalender öffnet sich über **Takvim** in einem separaten Dialog; er nimmt der Hauptanzeige keinen Platz weg. **Tam ekran** aktiviert den Vollbildmodus, sofern der Browser dies unterstützt. Auf älteren Browsern ohne native Dialogfunktion bleibt der Kalender über einen Dialog-Ersatz mit Escape- und Tastatursteuerung erreichbar.

### Gemessene Hochformat-Darstellung

Bei 1080 × 1920 Pixeln: sechs Zeilen von jeweils ungefähr 237 Pixeln Höhe, Zahlen mit ungefähr 225 Pixeln Schriftgröße, Original-Logo mit ungefähr 497 × 99 Pixeln. Alle sechs Zeiten bleiben gleichzeitig sichtbar. Schriftgrößen richten sich in aktuellen Browsern nach dem tatsächlich verfügbaren Platz der Zeile; ältere Browser erhalten eine an der Bildschirmgröße orientierte CSS-Alternative.

Die Browserprüfung misst die Position jeder Zeile und Ziffernfläche, die tatsächlichen Schriftgrößen und die Dokumentabmessungen. Getestet werden 1080×1920, 720×1280, 768×1366, 2160×3840, 1920×1080 sowie Handygrößen. Screenshots liegen als **display-screenshots** beim entsprechenden Actions-Lauf. Die Aufnahmen verwenden reproduzierbare Testdaten vom 12.10.2026; im Betrieb wird immer der aktuelle Tag aus der bestehenden Quelle geladen.

Eine physische Fernlesbarkeit aus 20 Metern kann ein Browser-Screenshot nicht garantieren. Bildschirmdiagonale, Montagehöhe, Helligkeit und Betrachtungswinkel müssen vor Ort geprüft werden. Das referenzierte Bildschirmfoto ließ sich während dieser Umsetzung nicht als Bild öffnen; die Prüfung erfolgte an den angegebenen Pixelauflösungen und den Original-Logo-Dateien.

### Dauerbetrieb

Die sechs Zeilen werden einmal angelegt. Unveränderte Uhrzeiten werden beim Sekundentakt nicht neu aufgebaut; Uhr und Countdown ändern nur betroffene Textknoten. Gebets-Timestamps werden beim Laden oder Tageswechsel berechnet, nicht ständig für den gesamten Kalender. Nach Netzwerkfehlern erfolgt ein automatischer neuer Versuch nach 30 Sekunden, mit zunehmendem Abstand bis maximal 15 Minuten. Ungültige oder für den aktuellen Tag fehlende Daten ergeben Platzhalter statt erfundener Zeiten. Die bestehende Zeitzonen- und Gebetszeitenlogik bleibt unverändert.

## GitHub Pages

`index.html`, `styles.css`, `prayer-core.js`, `app.js`, `data/` und das bestehende Logo gemeinsam im veröffentlichten Verzeichnis belassen. Bestehende Pages-Veröffentlichung aus `main` und `/ (root)` kann unverändert weiterverwendet werden. Es gibt keine zusätzliche Hosting-Plattform.

Unter **Actions → Update Linz prayer times** lässt sich die Aktualisierung jederzeit mit **Run workflow** manuell ausführen. Der Workflow benötigt `contents: write`, um ausschließlich seine Datendatei im Branch `prayer-data` zu aktualisieren. Bei fehlgeschlagenen Abrufen oder ungültigen Daten bleibt der letzte erfolgreiche Stand erhalten. GitHub deaktiviert geplante Workflows in öffentlichen Repositories nach 60 Tagen ohne Repository-Aktivität; gegebenenfalls den Workflow dort wieder aktivieren. Den Datenbranch nicht löschen.

## Lokal prüfen

```sh
python -m http.server 8000
node --test tests/prayer-core.test.cjs
```

Dann `http://localhost:8000` öffnen. Die Tests prüfen Quellentreue, fehlerhafte Daten, Gebetswechsel, Tageswechsel und beide Sommer-/Winterzeitwechsel. GitHub Actions prüft zusätzlich die Browserdarstellung, die Live-Datenquelle und die Übereinstimmung mit der Datenquelle der Originalseite.
