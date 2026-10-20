# Mini Drive – SQLite Database (Node built-in)

Uses **Node.js built-in `node:sqlite`** (Node 22.5+ / your v25 works).
No `better-sqlite3`, no native compile, no path issues with folder names.

## Database file
```
data/minidrive.sqlite
```

## Setup

**Important:** rename the project folder so it has **no spaces or parentheses**
(optional but avoids other tooling bugs):

```bash
cd ~/Downloads
mv "MiniDrive-updated (6) 4" MiniDrive
cd MiniDrive
rm -rf node_modules package-lock.json
npm install
npm start
```

Open http://localhost:3000/login.html

## Schema
- **users** – id, email, name, password_hash, picture, provider, google_sub, timestamps
- **files** – id, user_id, name, kind, parent_id, mime_type, size, storage_path, starred, shared, trashed, timestamps

Binary uploads: `data/uploads/{userId}/`

Old `users.json` / `files.json` are auto-migrated once on first start.
