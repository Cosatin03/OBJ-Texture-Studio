# TextureMap Studio

Ein browserbasiertes OBJ- und Texturemap-Studio für UV-Atlanten, direktes 3D-Painting und AI-kompatible Texture-Workflows. Alles läuft lokal im Browser; Modelle und Texturen werden nicht hochgeladen.

## Highlights

- OBJ-Import mit automatischer Erkennung koplanarer Flächen und überlappungsfreiem UV-Atlas
- 2D- und 3D-Painting mit Brush, Pencil, Eraser, Fill, Picker, Spray, Formen, Verlauf und Text
- Seam-Safe Painting, Backface-Option, Orbit, Pan und Zoom
- Geteilte, 3D-, Texturemap- und spezielle AI-Prep-Ansicht
- Export als PNG, JPG oder WebP sowie UV Guide, Island-ID-Mask und AI Reference Sheet
- OBJ/MTL/Texture-Paket, AI Prompt Brief und vollständiges `.tms.json`-Projektformat
- Import von Projekten, Bildern, OBJ-Dateien, GPL/TXT-Paletten, Drag & Drop und Bildern aus der Zwischenablage
- Undo/Redo, Autosave in IndexedDB, Tastenkürzel, responsives UI und GitHub-Pages-Workflow

## Lokal starten

```bash
npm run dev
```

Danach `http://localhost:4173` öffnen.

## Bedienung

- Linksklick malt auf Modell oder Texturemap.
- `Alt` + Ziehen oder Rechtsklick dreht das Modell.
- `Shift` + Ziehen oder Mittelklick verschiebt die Kamera.
- Das Mausrad zoomt.
- `B/P/E/F/I/S/L/R/O/G/T` wechseln die Werkzeuge.
- `Ctrl/Cmd + Z` macht rückgängig, `Shift + Ctrl/Cmd + Z` wiederholt.
- `Ctrl/Cmd + S` speichert ein Projekt, `Ctrl/Cmd + E` öffnet das Export Center.

## GitHub Pages

Der enthaltene Workflow veröffentlicht jeden Push auf `main` automatisch über GitHub Pages. In den Repository-Einstellungen muss als Pages-Quelle **GitHub Actions** ausgewählt sein.

## Lizenz

MIT
