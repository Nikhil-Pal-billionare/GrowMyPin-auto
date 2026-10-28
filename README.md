# GrowMyPin Studio

AI pin drafts for Etsy / Shopify sellers. The user reviews and approves every pin.
Only approved pins are published to Pinterest, and only after the user confirms.

Stack: plain HTML in /public + one Vercel serverless function (api/router.js) + Supabase. Only npm package: web-push.

## Files (v1.1 structure - keep these folders exactly)

```
package.json             web-push dependency (phone notifications)
vercel.json              ONE function + rewrites + daily cron
supabase.sql             all tables (run once in Supabase, safe to run again)
api/router.js            the ONLY serverless function. Sends /api/<route> to /server/routes
server/lib.js            session cookie, Pinterest fetch helpers
server/app.js            accounts (Supabase Auth), reports, emails, AI report builder
server/growth.js         profiles, admin check, image upload, web push
server/settings.js       settings you edit in Admin > Settings (offer, ribbon, banner, popup)
server/routes/...        every API route (auth, user, report, admin, track, me, generate ...)
private/admin.html       admin dashboard (served only to admins at /admin)
private/404.html         the 404 page non-admins see at /admin
public/signup.html       animated sign up -> offer -> Reserve my slot -> growth graph
public/home.html         personal home after login: store links, Pinterest pins, prediction, setup steps
public/gmp-growth.js     growth model + animated charts (same numbers on every page)
public/gmp.js            on every page: visit counter, message popup, Admin link, notifications
public/sw.js             service worker for phone notifications
public/manifest.json     install as app (needed for iPhone notifications)
public/404.html          404 page for wrong links
public/icon-*.png        app + notification icons
public/*.html, *.css     the rest of the site (index, app, report, legal pages)
```

Why one function: Vercel Hobby allows max 12 serverless functions. All 22 routes run inside
api/router.js, so you can add more routes later for free. Never put other .js files in /api.

## Growth forecast (how it works)

- History: daily impressions from the account's Pinterest analytics (up to 89 days).
- With 21+ days of real data, the forecast follows the account's own trend, blended with niche
  benchmarks. With less data it uses niche benchmarks and a quiet first 2 weeks.
- Strategy, pins per day and target countries move the forecast. Strategies that perform better
  on the account's real published pins get a boost (learning from results).
- Worst / average / best case are drawn 90 days ahead (3 months minimum).
- All assumptions are in the CONFIG block at the top of public/forecast.js (STRATEGIES, NICHES,
  COUNTRIES). Tune them with real results from GrowMyPin client accounts to make the forecast sharper.
- The UI always labels it as an estimate, not a guarantee.

## Setup (aaj ke liye, step by step)

1. New GitHub repo, e.g. `GrowMyPin-Studio`. Upload all files with the same folder structure.
2. Vercel > Add New Project > import the repo > Framework preset: Other > Deploy.
   Note the domain, e.g. `growmypin-studio.vercel.app`.
3. Pinterest developer app (developers.pinterest.com > My apps):
   - Redirect URI: `https://growmypin-studio.vercel.app/api/auth/callback`
   - Copy App ID and App secret.
4. Vercel > Project > Settings > Environment Variables:

| Name | Value |
|---|---|
| PINTEREST_APP_ID | your Pinterest app id |
| PINTEREST_APP_SECRET | your Pinterest app secret |
| PINTEREST_REDIRECT_URI | https://growmypin-studio.vercel.app/api/auth/callback |
| SESSION_SECRET | any random text, 32+ characters |
| ANTHROPIC_API_KEY | your Claude API key |
| ANTHROPIC_MODEL | optional, default claude-haiku-5-5 |
| PINTEREST_API_BASE | optional, leave empty (only set https://api-sandbox.pinterest.com/v5 if Pinterest asks you to test in sandbox) |

5. Redeploy (Deployments > Redeploy) so the env vars load.
6. Open `/app.html`, click Connect Pinterest, test with your own account.

## Free growth report (signup, AI forecast, email after 4 hours)

Flow: user creates an account on /report.html, adds their Etsy/Shopify link and what they sell.
The server reads the public shop (Shopify products feed, Etsy API if ETSY_API_KEY is set, or the page),
Claude builds a 6 month forecast (worst / avg / best per month) + audience, strategy and first steps.
The report is saved in Supabase right away but only shown after REPORT_DELAY_HOURS (default 4).
A cron job emails the user when it unlocks. If the user connected Pinterest first, their real daily
impressions are used as the starting point.

Pinterest profile links: real numbers come only from Connect Pinterest (official API). Before a user connects,
the home page can show their public pins from Pinterest's public RSS feed (pinterest.com/<name>/feed.rss).
Turn that off any time in Admin > Settings > "Show pins from a user's public Pinterest link".

### Setup

1. Supabase: create a project (or use your existing one).
   - SQL Editor > paste supabase.sql > Run.
   - Authentication > Providers > Email: keep it on.
   - Authentication > URL Configuration: Site URL = https://YOUR-SITE, add https://YOUR-SITE/reset.html to Redirect URLs.
   - Project Settings > API: copy the Project URL, the anon key and the service_role key.
2. Email (pick one):
   - Resend: needs your own domain (for example growmypin.in) verified in Resend. EMAIL_PROVIDER=resend.
   - Brevo: works without a domain, verify one sender email (single sender). EMAIL_PROVIDER=brevo.
3. Add the env vars below in Vercel and redeploy.
4. Background job every 10 minutes (pick one):
   - Supabase: uncomment the pg_cron lines at the bottom of supabase.sql, fill your site + CRON_SECRET, run them.
   - or cron-job.org: call https://YOUR-SITE/api/report/cron?key=YOUR_CRON_SECRET every 10 minutes.
   (vercel.json also runs it once a day as a backup. Vercel Hobby only allows daily crons.)
   Without a 10 minute job, reports still unlock on the page, but the email can be late.

| Name | Value |
|---|---|
| SUPABASE_URL | https://xxxx.supabase.co |
| SUPABASE_ANON_KEY | anon public key |
| SUPABASE_SERVICE_KEY | service_role key (secret, server only) |
| SITE_URL | https://growmypin-studio.vercel.app (no slash at end) |
| CRON_SECRET | any random text, 24+ characters |
| REPORT_DELAY_HOURS | optional, default 4 |
| REPORT_MODEL | optional, default claude-sonnet-5-5 |
| EMAIL_PROVIDER | resend or brevo |
| EMAIL_FROM | sender email, for example hello@growmypin.in |
| EMAIL_FROM_NAME | optional, default GrowMyPin |
| RESEND_API_KEY | if using Resend |
| BREVO_API_KEY | if using Brevo |
| ETSY_API_KEY | optional, Etsy Open API key, lets the AI read Etsy listings |

Your leads (name, email, WhatsApp, shop link) are in Supabase > Table Editor > growth_reports.

## Pinterest API application - text to paste

**App name:** GrowMyPin Studio

**Website:** https://growmypin-studio.vercel.app

**Privacy policy URL:** https://growmypin-studio.vercel.app/privacy.html

**Terms of service URL:** https://growmypin-studio.vercel.app/terms.html

**App description / use case:**

GrowMyPin Studio helps small Etsy and Shopify sellers market their products on Pinterest.
A seller connects their own Pinterest business account with OAuth and adds a product
(title, product link and product image). The app uses AI to write several pin drafts
(title, description, alt text). Every draft is shown to the seller in a review queue,
where they can edit, approve or reject it. Only pins the seller approves are published,
to a board the seller selects, after a final confirmation step. Nothing is posted
automatically without approval. The app also shows the seller their own account
analytics (impressions, outbound clicks, saves) so they can track results.
We do not sell or share Pinterest data. Access tokens are encrypted and stored only
in the user's browser session, and users can disconnect at any time.

**Scopes requested:** user_accounts:read, boards:read, pins:read, pins:write

## Demo video (record on screen, 1-2 min)

Pinterest review usually wants to see the full flow. Record this:

1. Open the landing page, show "You stay in control" and the Privacy Policy link.
2. Click Connect Pinterest > Pinterest consent screen > Give access.
3. Choose a board, add a product (title, link, image URL), click Create pin drafts.
4. Edit one draft, Approve two, Reject one.
5. Click Publish approved > confirmation dialog > Yes, publish.
6. Click View on Pinterest to show the live pin.
7. Show the Last 30 days analytics card, then Disconnect.

## Next phase (after approval)

- Supabase table for drafts + clients, so drafts survive across devices.
- Daily queue: user approves a week of pins in one go, a Vercel cron posts 5 per day.
- AI image generation step (lifestyle thumbnails) before the review queue.
- Billing: monthly base + view-based charge from the analytics endpoint, UPI AutoPay.

## v1.1 setup: sign up funnel, Diwali offer, admin panel, notifications

1. Supabase > SQL Editor > paste the whole supabase.sql > Run (safe to run again).
2. Supabase > Authentication > Users > Add user > create YOUR admin login (email + password,
   tick Auto Confirm). Admin emails can never be created from the public sign up form.
3. Team admins (can see the dashboard, cannot send messages): Supabase > Table Editor >
   admin_emails > Insert row > email in lowercase. Then create their login like step 2.
4. Vercel > Settings > Environment Variables, add:

| Name | Value |
|---|---|
| SUPER_ADMIN_EMAIL | your email - the only one who can send messages / notifications |
| VAPID_PUBLIC_KEY | from the setup message (web push public key) |
| VAPID_PRIVATE_KEY | from the setup message (web push private key, keep secret) |

   (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SESSION_SECRET stay as before.)
5. Redeploy. Open /signup.html#login, log in with the admin email -> you land on /admin.
   Anyone else opening /admin gets the normal 404 page.

Flow: any Connect Pinterest button -> /signup.html -> account created -> Diwali offer
(Reserve my slot / I'll regret) -> I'll regret goes home -> Reserve my slot asks 6 questions ->
Submit -> confetti + growth graph (3 and 6 months) -> Connect Pinterest.

All offer texts, %, start/end dates, ribbon, home banner, popup timing and your WhatsApp number
are changed in /admin > Settings (owner only). Team admins are added/removed in /admin > Admins.

Notifications: Android Chrome works directly. iPhone needs iOS 16.4+ and the site added to the
Home Screen first (the app tells the person how). People without notifications see your message as a
popup the next time they open any GrowMyPin page.

## v1.2: settings from the admin panel, personal home page, visits popup

1. Run supabase.sql again (adds profile columns and the site_settings table).
2. Upload the new and changed files, redeploy.
3. /admin > Settings: set offer name, %, start and end (India time), texts, ribbon, banner,
   popup minutes and your WhatsApp number. Save = live for everyone.
4. /admin > Admins: add a team admin with email + password (login is created for them), or remove.

After login people land on /home.html (the landing page redirects logged-in visitors there;
/?landing=1 still opens the landing page). The "Your Pinterest views can reach" popup shows once a day
after the set minutes of total time on the site. "I want to increase visits" marks the person as
"Wants more visits" in the admin People table (filter chip + KPI).
