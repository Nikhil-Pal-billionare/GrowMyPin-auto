# GrowMyPin Autopilot - project summary (v1.3, 29 Oct 2026)

Paste this into a new chat to continue.

## What it is
GrowMyPin Studio: Pinterest marketing app for Etsy / Shopify / eBay sellers.
Plain HTML + Vercel (one serverless function) + Supabase (database + login). Only npm package: web-push.
Live on Vercel (Hobby plan). Owner edits code via GitHub web/mobile UI, so all code is ASCII only.

## Folder structure (56 files, must stay exactly like this)
- api/router.js: the ONLY Vercel function. vercel.json rewrites /api/<route> -> /api/router?__r=<route>
  and /admin -> admin page. Never add other files in /api (Hobby limit is 12 functions).
- server/lib.js (cookies, Pinterest OAuth/API), server/app.js (Supabase auth + db, email, AI report),
  server/growth.js (profiles, admin check, image upload, web push), server/settings.js (admin-editable settings).
- server/routes/: admin.js, track.js, me.js, analytics.js, generate.js, publish.js, pin-stats.js,
  auth/(login, callback, logout), user/(signup, login, logout, me, forgot, reset, hub, home),
  report/(create, get, cron).
- private/admin.html + private/404.html: served only by the server (not public).
- public/: index.html (landing, logged-in users auto-redirect to /home.html; /?landing=1 skips),
  signup.html, home.html, app.html (Pin Studio), report.html, reset.html, 404.html, legal pages,
  brand.css, style.css, gmp.js (on every page), gmp-growth.js (growth model + charts), pins.js,
  forecast.js, sw.js, manifest.json, icons, favicon.ico.
- supabase.sql: full DB setup, safe to run again.

## User flow
1. Any "Connect Pinterest" button -> /signup.html (4 animated steps: name, email, WhatsApp, password,
   live "GrowMyPin pass" card, password diyas).
2. After signup: offer screen (texts/%/dates from Admin > Settings; diyas, fireworks, countdown).
   "I'll regret" -> /home.html. "Reserve my slot" -> quiz: where you sell (Etsy/eBay/Shopify, multi),
   sales per month (10/100/1000), how long you can wait (1/2/3/6 months), shop links (Skip),
   Pinterest active? (No -> phone step; Yes -> link + Skip), phone (required), Submit (never auto).
3. Submit -> confetti + "Form submitted successfully" + popup with animated 3/6 month graph per platform.
4. /home.html: setup checklist ring, offer banner, store links (editable), monthly goal bars,
   Pinterest pins (official API if connected, else public RSS feed of the profile link if enabled),
   prediction chart, "Increase my <store> store visits" button, how-it-works.
5. Popup "Your Pinterest views can reach X to Y" + unnumbered animated store-visits graph: once a day
   after N minutes total on the site (N from settings). Buttons: "I want to increase visits" (marks
   lead interest_at) / "I'll do later".
6. Messages from admin show as popup on any page + web push notification (Android direct; iPhone needs
   Add to Home Screen).

## v1.3 Personal growth graph (29 Oct 2026)
- public/gmp-growth.js = growth model + forecast widget (GMPGrowth.mount). Used by home.html, signup.html
  forecast popup, gmp.js visits popup and the admin preview. No per-day numbers anywhere: monthly views,
  3 month and 6 month totals, plus store visits.
- Graph data lives in site_settings.data.growth (server/settings.js DEFAULT_GROWTH + normalizeGrowth):
  niches[] { name, views[5 ranks][6 months], visits[5][6] }, rank { _all: [...], "<niche>": [...] },
  strategies (names), tier_pct, pins_pct (0 / 1-24 / 25-99 / 100-299 / 300+ pins), stores (visits %, sale %), vary.
  Numbers belong to the RANK (Best, 2nd best, Middle, 2nd worst, Worst); the admin decides which strategy sits at each rank.
- Per user: niche (quiz step "What do you sell?" + home picker), pins on Pinterest (API pin_count when connected,
  else what they pick), current monthly views (API), store, sales goal, small seeded variation.
- Admin > Growth graph tab: ranking per niche, numbers per niche, add/remove niches, names, pins bonus, stores, live preview.
- profiles: niche, pins_count, pin_stats (run supabase.sql v1.3 part). hub action "growth".

## v1.3.1 (30 Oct 2026)
- Repo: github.com/Nikhil-Pal-billionare/GrowMyPin-auto (main), live at growmypin-auto.vercel.app.
- Forecast widget is LIGHT mode. Graph = 2 colors: Patience (orange, first month(s)) and Reward (green). Other strategies are grey lines.
- Popups (visits popup in gmp.js, signup forecast popup) and the home Diwali offer banner use a purple night sky
  with stars, sky lanterns and small fireworks: window.GMPSky(element) in gmp.js.
- Home hero: time-based greeting with first name, rotating "Your news for <day>" card (Pinterest views if connected,
  forecast, sales goal, season, New York time), 3 stat tiles, floating pin tiles, scroll reveals, confetti at 100% setup.
- /api/auth/login: if PINTEREST_APP_ID / PINTEREST_APP_SECRET / PINTEREST_REDIRECT_URI missing, user goes back
  with ?pinterest=soon and home shows a friendly message + Pinterest link box (no raw JSON error).
- PINTEREST_REDIRECT_URI = https://growmypin-auto.vercel.app/api/auth/callback (also add in Pinterest app > Configure > Redirect URIs).

## v1.4 Plans + Razorpay (30 Oct 2026)
- Plans: Monthly Rs 1499 (old price Rs 2999 struck), 3 months Rs 2999, 6 months Rs 5999, 1 year Rs 11999,
  plus view levels (25K Rs 1499, 50K Rs 2500, 1L Rs 4000, 2L+ Rs 5500 a month). All editable in Admin > Plans and payments.
  Stored in site_settings.data.plans (server/settings.js DEFAULT_PLANS + normalizePlans). No Rs 4000 month-1 charge.
- Plans are shown ONLY after Pinterest is connected. /api/user/home returns `plans` only when connected
  (or for an admin with ?plans=preview). Prices are removed from publicSettings, so no page leaks them before.
- Home reveal popup (public/gmp-plans.js, night sky): 1 Connected (real views + pins) -> 2 3-month growth
  (patience -> reward) -> 3 plan cards + view levels + Razorpay pay -> 4 You're in (confetti). Shown once per
  person, and again on every ?connected=1. Light plan section #planBox on home below the forecast.
- Signup "Connect Pinterest" now returns to /home.html (the reveal), not /app.html.
- Razorpay: server/billing.js + server/routes/pay.js. /api/pay/order (amount from settings, never the browser),
  /api/pay/verify (HMAC signature + fetch payment from Razorpay, capture if only authorized), /api/pay/status.
  Late payments (window closed) are picked up on next home load (?paycheck=1) via reconcileUser().
  Plan stacks: a new plan starts when the current one ends. profiles.plan_id/plan_name/plan_until.
- Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (rzp_test_ first, then rzp_live_). Without them the pay button
  shows "opens very soon" + WhatsApp link.
- SQL: run v1.4 part of supabase.sql (payments table + profile plan columns).
- Admin > Plans and payments: edit plans/levels, preview (/home.html?plans=preview, &open=1 for plans only),
  revenue, paid orders, active plans, "opened checkout but did not pay" hot leads with WhatsApp links.
- Not automatic yet: view level charges (collect with a Razorpay link). billing.html still says milestones are
  charged once; update it to monthly levels before going live.

## v1.5 Real people vs bots (30 Oct 2026)
- gmp.js sends signals (navigator.webdriver, screen size, languages, time zone) and a "human" event on the first
  real mouse movement / scroll / tap / key press. /admin and admin logins mark the browser as staff (gmp_staff).
- /api/track flags bot (UA list incl. HeadlessChrome/crawlers, webdriver, no Accept-Language, no real screen) and staff.
- gmp_admin_stats(days, view_mode): visitor = real (human event, no bot signal), bot (bot signal or never interacted),
  staff. Dashboard has Real people / Bots / You and team / Everyone switch with counts. Run v1.5 part of supabase.sql.
- Visits before this change had no human check, so they show under Bots.

## Admin (/admin)
- Access: SUPER_ADMIN_EMAIL (Vercel env, owner, full access) + emails in table admin_emails (view only).
  Anyone else gets the normal 404 page. Admin emails cannot be created via public signup.
- Login at /signup.html#login -> redirects to /admin.
- Tabs: Growth graph (see v1.3), Dashboard (visitors, visits, bounce rate, avg visit, signups, slots, "want more visits",
  phones with alerts, daily chart, funnel, top pages/refs/devices/countries, people table with
  filters/search/WhatsApp links/CSV download, message composer with image + phone preview),
  Settings (owner only: offer on/off, name, %, start/end IST, texts, buttons, diyas, ribbon, home banner,
  popup on/off + minutes + texts, sales WhatsApp number, pins-from-profile-link toggle; placeholders
  {first} {offer} {percent} {store}), Admins (owner only: add with email + password, remove).

## Supabase tables
growth_reports, profiles (incl. platforms, shop_links, pinterest_url, target_sales, wait_months,
interest_at, interest_count, interest_source, offer_status), slot_reservations, page_views, admin_emails,
push_subscriptions, user_messages, site_settings (1 row jsonb), function gmp_admin_stats(days),
storage bucket gmp-messages. All RLS on, only service key reads/writes.

## Vercel env vars (tick Production + Preview + Development, then Redeploy)
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY (use LEGACY anon/service_role keys, eyJ...),
SESSION_SECRET (32+ chars, never change), SUPER_ADMIN_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
SITE_URL, PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_REDIRECT_URI (https://SITE/api/auth/callback),
ANTHROPIC_API_KEY. Optional: EMAIL_PROVIDER, EMAIL_FROM, RESEND_API_KEY / BREVO_API_KEY, CRON_SECRET,
ETSY_API_KEY, REPORT_DELAY_HOURS, REPORT_MODEL, ANTHROPIC_MODEL.

## Status (29 Oct 2026)
- Deployed. Signup page works. SESSION_SECRET error fixed by adding the env var.
- Admin panel opens. Dashboard showed "Could not find function gmp_admin_stats" -> fix: run full
  supabase.sql in SQL Editor (ends with notify pgrst, 'reload schema').
- Tested locally (Postgres + PostgREST): all flows. NOT tested live: Pinterest API pins, Pinterest RSS
  feed, real phone push delivery.

## Open ideas / next steps
- Optional: fallback in server/lib.js so SESSION_SECRET is derived from SUPABASE_SERVICE_KEY if missing.
- Discount is display only; no billing/payment link yet (deals closed on WhatsApp).
- Old /report.html still has its own signup form.
- Always use the main Vercel domain, not preview links (preview links may miss env vars).
