# Environment and account setup

Everything TrustGuard needs runs on free tiers. This page covers the accounts to create and every environment variable, in the order you need them.

Local values go in `apps/web/.env.local`. That file is gitignored. Never commit real values anywhere, and never paste them into issues or chat.

## Variables

| Variable | Used by | Where it comes from |
|---|---|---|
| `DATABASE_URL` | web, migrations | Supabase, transaction pooler connection string |
| `AUTH_SECRET` | web | Generated locally, see below |
| `AUTH_GITHUB_ID` | web | GitHub OAuth app, Client ID |
| `AUTH_GITHUB_SECRET` | web | GitHub OAuth app, Client secret |
| `AUTH_GOOGLE_ID` | web | Google Cloud OAuth client, Client ID |
| `AUTH_GOOGLE_SECRET` | web | Google Cloud OAuth client, Client secret |

Worker variables (VirusTotal, Safe Browsing and URLhaus keys) are added in phase 2.

## 1. Supabase (database)

1. Sign in at https://supabase.com with GitHub. No card is needed.
2. **New project**. Name it `trustguard`, pick the region closest to you, and generate a strong database password. Save the password in a password manager; Supabase only shows it once.
3. Wait for the project to finish provisioning (a minute or two).
4. Click **Connect** at the top of the project dashboard.
5. Copy two connection strings and replace `[YOUR-PASSWORD]` in each with the database password:
   - **Transaction pooler** (port `6543`). This is `DATABASE_URL` for the app.
   - **Session pooler** (port `5432`). Use this one only when running migrations, because migrations need a full session.

Run the migrations once (PowerShell):

```powershell
$env:DATABASE_URL="<session pooler string>"; pnpm --filter @trustguard/db migrate
```

Then open **Table Editor** in Supabase and check that tables such as `orgs`, `memberships` and `investigations` exist.

A free project pauses after 7 days with no activity. Once the worker is running, its scheduled jobs keep it active. If it does pause, click **Restore** in the dashboard.

## 2. AUTH_SECRET

Generate 32 random bytes:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use a different value for local and production.

## 3. GitHub sign-in

1. Go to https://github.com/settings/developers, then **OAuth Apps**, then **New OAuth App**.
2. Fill in:
   - Application name: `TrustGuard (local)`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. **Register application**.
4. Copy the **Client ID** into `AUTH_GITHUB_ID`.
5. **Generate a new client secret** and copy it into `AUTH_GITHUB_SECRET` right away. GitHub only shows it once.

For production, create a second OAuth app named `TrustGuard` with your Vercel URL as the homepage and `https://<your-vercel-domain>/api/auth/callback/github` as the callback. GitHub OAuth apps take a single callback URL, so local and production need separate apps.

## 4. Google sign-in

1. Go to https://console.cloud.google.com and create a project named `TrustGuard`. No billing account is needed for sign-in.
2. Open **APIs & Services**, then **OAuth consent screen** (shown as **Google Auth Platform** in newer consoles), and start the setup:
   - App name: `TrustGuard`
   - User support email: your email
   - Audience: **External**
   - Developer contact email: your email
3. Under **Data access** (or **Scopes**), add only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. These basic scopes don't need Google's verification review.
4. Under **Audience**, add your own Google account as a **test user**. While the app is in testing mode, only test users can sign in. Click **Publish app** when you want anyone to be able to sign in; with basic scopes only, this doesn't trigger a review.
5. Open **Credentials** (or **Clients**), then **Create credentials**, then **OAuth client ID**:
   - Application type: **Web application**
   - Name: `TrustGuard web`
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy the **Client ID** into `AUTH_GOOGLE_ID` and the **Client secret** into `AUTH_GOOGLE_SECRET`.

Unlike GitHub, one Google client can hold several redirect URIs. For production, add `https://<your-vercel-domain>` as an origin and `https://<your-vercel-domain>/api/auth/callback/google` as a redirect URI on the same client.

## 5. Put it together

`apps/web/.env.local`:

```
DATABASE_URL=postgresql://postgres.xxxx:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
AUTH_SECRET=<generated value>
AUTH_GITHUB_ID=<client id>
AUTH_GITHUB_SECRET=<client secret>
AUTH_GOOGLE_ID=<client id>.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=<client secret>
```

Start the app with `pnpm --filter web dev` and open http://localhost:3000. If a variable is missing, startup stops with a message naming it.

## If a secret leaks

Rotate it at the source (Supabase: reset the database password; GitHub or Google: generate a new client secret; `AUTH_SECRET`: generate a new one, which signs everyone out), update `.env.local` and Vercel, and redeploy.
