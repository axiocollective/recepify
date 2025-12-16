# Recipefy MVP

Recipefy importiert Rezepte aus Web, TikTok und Pinterest, speichert sie als einheitliche Datensätze und zeigt sie in einem modernen UI an. Dieses Repository enthält:

- **backend/** – FastAPI + SQLite + Storage für Medien  
- **frontend/** – Next.js (App Router) + Tailwind + shadcn/ui Komponenten  
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
frontend/
  app/              # Next.js App Router Screens
  components/       # UI-Bausteine (Tailwind + shadcn patterns)
  types/            # Shared client-side Types
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

## Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Frontend läuft auf `http://localhost:3000` und kommuniziert via CORS mit dem Backend. Alle Screens (Home, Add, Detail, Edit, Settings, Onboarding, Splash) sind bereits als Platzhalter vorhanden, inklusive Layout/Typografie laut Figma-Vorgabe (helle, minimalistische Oberfläche).

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
2. **API/Frontend verdrahten**: Import-Screen ruft Backend, schreibt Datensätze in Supabase/SQLite und öffnet Edit-Screen mit Prefill.
3. **Feinschliff UI** sobald Figma-Screens final sind (Spacing, Komponenten, Media-Player).
4. **Persistente Medienablage**: Videos werden in `/backend/storage/{recipeId}` gespeichert, Bilder optional ebenfalls.

Sobald du die Figma-Dateien im Projektordner ablegst, können die Komponenten pixelgenau angepasst werden.

## Anmeldung (Google, Apple, E-Mail)

Die Next.js App nutzt Supabase Auth für die Anmeldung. Richte folgende Schritte ein:

1. In Supabase → *Authentication → URL configuration* die `SITE_URL` z.B. auf `http://localhost:3000` setzen.
2. Unter *Providers* Google und Apple aktivieren (Client-ID/Secret eintragen).
3. Unter *Email templates* sicherstellen, dass Magic Links aktiviert sind.
4. In `frontend/.env.local` zwei Variablen setzen:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   ```
5. `npm install` ausführen, damit `@supabase/supabase-js` installiert wird, anschließend `npm run dev`.

Danach erscheint vor der App ein Login-Screen mit „Continue with Google/Apple“ sowie E-Mail-Magic-Link.

## Deployment (GitHub & Vercel)

1. **Repo vorbereiten** – das Build-Directory `.next/` und lokale Datenbanken sind jetzt in `.gitignore` hinterlegt, daher genügt ein `git status`, um nur echte Änderungen zu sehen. Vor jedem Push einmal `npm run lint && npm run build` laufen lassen.
2. **Commit & Push** – falls das Repo noch nicht verbunden ist: `git remote add origin <github-url>` und `git push -u origin main`. Secrets (`.env`, `.env.local`) bleiben lokal.
3. **Vercel einrichten**
   - Auf [vercel.com](https://vercel.com) „New Project → Import Git Repo“, `Recepify/frontend` als Root Directory wählen.
   - Install Command `npm install`, Build Command `npm run build`, Output `.next`.
   - Unter „Environment Variables“ alle Werte aus `frontend/.env.local` sowie benötigte Backend-URLs eintragen.
4. **Deploys verifizieren** – nach dem ersten Deploy prüft Vercel Preview/Production automatisch jeden neuen Push. Fehlerhafte Builds lassen sich über das Dashboard einsehen (Logs + Rollbacks).

Optional kannst du ein `vercel env pull .env.local` nutzen, sobald Vercel die Variablen verwaltet.
