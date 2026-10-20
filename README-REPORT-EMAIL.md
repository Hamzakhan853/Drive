# Report bug email on Render

## Why SMTP fails
Render (and many hosts) **block outbound SMTP** (ports 25/465/587).
You will see: `SMTP failed: Connection timeout`

## Fix: Resend (recommended, free HTTPS)

1. Sign up: https://resend.com
2. Create an API key
3. On Render → Environment, add:

| Key | Value |
|-----|--------|
| `RESEND_API_KEY` | `re_........` |
| `REPORT_TO` | `hamzakhancollege4@gmail.com` |
| `RESEND_FROM` | `MiniDrive <onboarding@resend.dev>` (testing) |

4. Redeploy and test Report bug.

**Note:** With `onboarding@resend.dev`, Resend only delivers to the email you used to sign up at Resend. Sign up with hamzakhancollege4@gmail.com, or verify your own domain later.

## Alternative: Web3Forms

1. https://web3forms.com → get access key
2. Render env: `WEB3FORMS_ACCESS_KEY=...`

## Local Mac
Gmail SMTP via `.env` often works locally. On Render use Resend.
