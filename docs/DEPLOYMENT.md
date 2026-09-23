# Deploy News Pulse

This source package is ready to configure for hosting. It does **not** contain an already-created GitHub repository, hosted database or live URL. Docker build and hosted PostgreSQL behavior must be verified on the target host; see `VALIDATION.md` for tested paths.

## Recommended layout: one Docker service + PostgreSQL

- **React:** built by Docker and served as static files by Node.
- **Node API:** the same web service.
- **Python:** installed in that container; Node starts it on refresh. Startup collection is optional.
- **Database:** external hosted PostgreSQL, configured through `DATABASE_URL` for both languages.

This keeps deployment simple and permits an actual Python subprocess. A frontend-only/static host or edge Worker alone cannot run this project's Python process.

### 1. Put the project on your GitHub

Create a new **empty** repository using your account, without a README, license or `.gitignore` on GitHub.

If you used the optional 30-commit helper from `START_HERE_HINGLISH.md`, your local repository and commits already exist: use only the `git remote add origin ...` and `git push -u origin main` commands below. Do not create an extra initial commit.

For an ordinary single initial commit instead, run these commands in the extracted `news-pulse` folder:

```sh
git init
git add .
git commit -m "Build News Pulse full-stack assessment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/news-pulse.git
git push -u origin main
```

Replace `YOUR_USERNAME`. `.gitignore` excludes `.env`, database files, `.venv`, packages and generated output. Before pushing, check `git status` and do not stage secrets. These commands create a new project; do not run `git init` inside another existing repository.

### 2. Create the hosted PostgreSQL database

Choose a provider such as Neon or Supabase. Create a database using your own account and copy its PostgreSQL connection string into the hosting environment variable form. Use the provider's TLS-enabled URL and preferably its documented pooled endpoint. Do not paste credentials into the README, frontend, screenshots or chat.

The application creates its tables automatically. An example URL shape is `postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`, but use the exact value from your provider.

The code supports SQLite locally and PostgreSQL in hosting. No data migration is needed for a new hosted instance: it collects live news into the hosted database. Existing local news is not automatically uploaded.

### 3. Deploy on Render

1. Connect your GitHub repository through Render's own sign-in flow.
2. Create a **Blueprint** using the included `render.yaml`, or create a **Web Service** with runtime **Docker** and Dockerfile `./Dockerfile`.
3. Set `DATABASE_URL` to the provider's connection string. This is required for the diskless deployment.
4. Set `AUTO_INGEST=true` to collect once in the background at startup.
5. Set health check path to `/health`.
6. Deploy, wait for a healthy service, then open its assigned URL. The first news fetch can take several minutes.

`render.yaml` requests a free web-service instance and does not declare a paid database or disk. Check the provider's current plan availability, sleep behavior, quotas and billing prompts before confirming. No service has been purchased for you.

**Do not use a SQLite file on a temporary hosting filesystem for persistent production data.** Render services have ephemeral filesystems by default; persistent disks require an eligible paid service. With the included blueprint, PostgreSQL provides durability instead. Source: https://render.com/docs/disks and https://render.com/docs/free

Keep **one service instance**. The current job lock is in-process; horizontal scaling needs a shared queue/distributed lock.

### 4. Verify the published service

Use your actual assigned URL in each check:

- `/`: frontend opens after a cold start.
- `/health`: returns `status: ok`.
- `/api/timeline`: returns data once ingestion has completed.
- Click Refresh, observe progress and completion.
- Check Headlines, search/categories, saved articles and theme switching.
- Open Compare sources on a topic with multiple outlets.
- Click a topic, verify its articles and their original links.
- Toggle a source; counts and timeline intervals should update.
- Restart/redeploy once and confirm data remains in PostgreSQL.
- Test the public URL on your phone or in a private browser window.

If the service sleeps on its selected plan, allow its normal cold-start delay before retrying. The health endpoint does not wait for news collection.

### 5. Submission URLs

The frontend and API may share one host. Submit your actual frontend URL and the same URL plus `/api` as the backend base URL, with `/api/health` and `/api/timeline` as readable examples. The README documents all endpoints.

Do not invent live URLs or mark deployment complete until these checks pass.

## Optional split deployment

If you prefer Vercel/Netlify for the frontend, deploy only its built static assets and keep the Docker service for Node/Python. Set the frontend build-time environment variable `VITE_API_BASE_URL` to the public backend URL ending in `/api`; set backend `CORS_ORIGIN` to the exact frontend origin. From the repository root build with `npm ci && npm run build`; publish `frontend/dist`.

## Docker locally

```sh
docker compose up --build
```

Visit http://localhost:3001. The named `news-data` volume persists SQLite. `docker compose down` stops services and retains that volume; avoid adding `-v` unless you intentionally want to delete the stored data.
