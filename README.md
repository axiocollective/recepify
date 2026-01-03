# Recipefy MVP

Recipefy importiert Rezepte aus Web, TikTok und Pinterest, speichert sie als einheitliche Datensätze und zeigt sie in einem modernen UI an. Dieses Repository enthält:

- **backend/** – FastAPI + SQLite + Storage für Medien  
- **apps/mobile/** – Expo/React Native Client (iOS/Android)  
- **packages/shared/** – Wiederverwendbare TypeScript-Konstanten/Types  
- **figma/** – (vom Nutzer bereitgestellt) Design-Referenzen für das finale UI

> 🎯 Aktueller Stand: Grundgerüst ist lauffähig (CRUD-Endpunkte, Routen, Screens). Import-Services sind als Platzhalter angelegt und werden mit den vorhandenen Colab-Skripten befüllt.

## Projektstruktur

```
backend/
  app/
    api/            # REST & Import-Endpunkte
    models.py       # SQLModel Tabellen
    services/       # Import-Adapter (Web/TikTok/Pinterest)
    main.py         # FastAPI App
  storage/          # Medienablage (wird automatisch erstellt)
  pyproject.toml
  requirements.txt
apps/
  mobile/           # Expo/React-Native App
packages/
  shared/           # constants/, types/
README.md
```

## Voraussetzungen

- Python 3.11+
- Node.js 18+
- ffmpeg & yt-dlp verfügbar im PATH (für TikTok-Import später)

## Backend starten

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env  # OPENAI_API_KEY & STORAGE_DIR eintragen
uvicorn app.main:app --reload
```

Standard-URL: `http://127.0.0.1:8000`. Die CRUD-API liegt unter `/api/recipes`, Import-Endpoints unter `/api/import/...` (liefern aktuell HTTP 501 bis die Skripte portiert sind).

## Mobile App (Expo) starten

```bash
npm run dev:mobile
```

Die Expo CLI öffnet einen QR-Code (Expo Go App) oder startet iOS-/Android-Simulatoren.

## Persistenz mit Supabase

Für ein produktionsreifes Setup kann der FastAPI-Server direkt mit Supabase Postgres sprechen.

1. Projekt bei [supabase.com](https://supabase.com) anlegen und Datenbank-Passwort merken.
2. SQL-Editor öffnen und das Skript [`supabase/schema.sql`](supabase/schema.sql) ausführen.
3. `backend/.env.example` → `.env` kopieren und `DATABASE_URL` auf die Supabase-Verbindungszeichenkette
   setzen (`postgresql+psycopg://postgres:<pass>@db.<id>.supabase.co:5432/postgres?sslmode=require`).
4. Backend neu starten – `init_db()` legt Tabellen automatisch an und alle Importe landen nun
   persistent in Supabase. Eine ausführlichere Anleitung liegt in [`supabase/README.md`](supabase/README.md).

## Nächste Schritte

1. **Import-Services aus Colab portieren** (`backend/app/services/*`). Sie sollen exakt `import_web(url)`, `import_tiktok(url)` und `import_pinterest(url)` bereitstellen und Recipe-Dicts zurückgeben.
2. **API/Mobile verdrahten**: Import-Screen ruft Backend, schreibt Datensätze in Supabase/SQLite und öffnet Edit-Screen mit Prefill.
3. **Feinschliff UI** sobald Figma-Screens final sind (Spacing, Komponenten, Media-Player).
4. **Persistente Medienablage**: Videos werden in `/backend/storage/{recipeId}` gespeichert, Bilder optional ebenfalls.

Sobald du die Figma-Dateien im Projektordner ablegst, können die Komponenten pixelgenau angepasst werden.

## Railway Backend (mit Docker)

TikTok-Importe benötigen `ffmpeg`. Für Deployments auf Railway (oder anderen Containern) läuft die FastAPI-App daher über `backend/Dockerfile`, das alle Abhängigkeiten inkl. `ffmpeg` installiert. Schritte:

1. Railway → Service → *Settings → Deploy* → **Builder = Dockerfile**, Pfad `backend/Dockerfile`.
2. Environment Variablen setzen (`DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_VISION_API_KEY`, `STORAGE_DIR`, `ASSISTANT_MODEL_PRIORITY`, `FRONTEND_ORIGINS` usw.).
3. Redeploy auslösen – danach stehen alle Importpfade bereit (Web, TikTok, Pinterest, Scan).
