# Mini Drive + Supabase Cloud Storage

File **bytes** go to **Supabase Storage** (cloud).  
File **metadata** + users stay in **SQLite** (`data/minidrive.sqlite`).  
Each user only sees their own files (`{userId}/...` paths in the bucket).

## 1. Create a Supabase project

1. Go to https://supabase.com → New project  
2. **Storage** → **New bucket**  
   - Name: `minidrive`  
   - **Private** (recommended)  
3. **Project Settings → API**  
   - Copy **Project URL**  
   - Copy **service_role** key (server only — never put this in the browser)

## 2. Configure Mini Drive

```bash
cd MiniDrive
cp .env.example .env
```

Edit `.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SUPABASE_BUCKET=minidrive
```

## 3. Install & run

```bash
npm install
npm start
```

You should see:

```
[storage] Supabase cloud storage ENABLED. Bucket: minidrive
Storage: supabase
```

If env vars are missing, it falls back to local disk:

```
[storage] Supabase not configured — using local disk
Storage: local
```

## How it works

| Data | Where |
|------|--------|
| Users, folders, file names, trash, stars | SQLite |
| Actual file content (PDF, images, video…) | **Supabase Storage** |
| Path in bucket | `{userId}/{uuid}.ext` |

Upload / open / delete all go through your Node server, which talks to Supabase with the service role key.

## Security notes

- Use **service_role** only on the server (already the case).  
- Keep the bucket **private**.  
- Do not commit `.env` to Git.
