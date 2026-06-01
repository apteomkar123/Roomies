# Roomies — Feature Status

A living document tracking what's shipped, what works, and what's pending.

---

## ✅ Implemented & Working

### Auth
- Email / password sign-in and sign-up
- Show/hide password toggle (eye icon) on password fields
- Forgot password (email reset link)
- **Sign in with AppWare** — "Sync your AppWare apps!" tagline above button; redirects to authappware.netlify.app SSO portal, returns with hash tokens injected into Supabase session
- Google and Apple sign-in removed (replaced by AppWare SSO)
- Client-side profile row creation fallback (for when DB trigger fails silently on signup)
- Password reset screen (redirected from Supabase reset email)
- **Auth loading bug fix** — resolved infinite spinner; SSO null `INITIAL_SESSION` handled

### Onboarding
- Multi-step flow: sign-in/sign-up → profile setup (username, avatar) → create or join a household
- **Auto-import AppWare profile photo** on step 2 — shows "import or change" dialog automatically
- **Onboarding redirect guard** — if user already has a household, skip onboarding entirely (no data loss)
- **Blob URL bug fix** — photo upload failures no longer persist invalid blob: URLs to the DB
- Avatar picker with DiceBear presets
- Invite-code based household joining
- iOS cursor glitch fix

### Tutorial
- **Interactive tutorial** — runs automatically on first login after onboarding; fixed condition so null/undefined treated as not-completed
- **Tutorial tooltip clamping** — tooltips never go off-screen; flip top/bottom automatically
- Skip / dismiss marks tutorial complete
- Re-run Tutorial button in Settings (More page)
- Confetti on finish

### Dashboard
- Roommate presence status (Available / Sleeping / Quiet Hours / WFH / Away) — real-time via Supabase Realtime
- **Utility Booker** (renamed from Appliance Booker) — tap your own booking to cancel it; add custom utilities via "+ Add Utility" stored per household in localStorage
- Pet log quick actions widget
- Lockbox secret reveal widget
- "Buzz in" button for common entry intercom

### Chores
- Chore list with rotation tracking
- Assign chores to household members
- Mark chores complete
- **Chore Calendar** — 14-day horizontal scrolling calendar showing upcoming assignments grouped by date

### Finance
- Household expense tracking
- Debt minimization algorithm
- Guest surcharge calculation

### Notices
- Household notice board (post and view notices)
- Real-time updates via Supabase Realtime

### Bookings
- Shared resource booking (Washing Machine, Dryer, Parking Bay A/B, BBQ, Rooftop + custom)
- Conflict detection
- Real-time updates

### Maintenance
- Maintenance request submission and tracking
- Status workflow (open → in-progress → resolved)

### Lockbox
- Shared household secrets / passwords
- Reveal toggle per secret
- **Wi-Fi connect** — secrets with "wifi" in the name show "Copy Password" + "Open Wi-Fi Settings" buttons when revealed

### Guests
- Guest visit log (name, date, duration)
- Tracks who invited the guest

### Shopping
- Shared household shopping list
- Add / remove items, mark as bought
- **Hungry sync** — adding items fires a cross_app_activity event to sync with Hungry

### Pets
- Pet care log (Morning Feed, Evening Feed, Daily Walk, Medication Administered)
- **Deselect actions** — tap your own logged action again to undo it
- **Custom pet chores** — add pet-specific chores per pet (stored per household in localStorage)
- Per-pet tracking within a household

### Karma Leaderboard
- `/karma` page showing ranked household members by karma score
- Medal icons for top 3 positions
- "How to earn karma" guide panel

### More / Settings
- Navigation hub for secondary pages
- **Multiple households** — view all households, switch active, join a new one via invite code, or create a new one; switches fire cross_app_activity for Hungry sync
- Sign out
- Re-run Tutorial

### Readability
- Removed default mobile tap-highlight across all elements
- Darker gradient + text-shadow on active nav items for better contrast

---

## ❌ Not Yet Implemented / Known Gaps

- Push notifications for notices, maintenance updates, bookings
- Deep link sharing for individual resources
- Native mobile app (iOS / Android) — Wi-Fi auto-connect is best-effort on web
- Google / Apple SSO (intentionally removed; AppWare SSO used instead)
- Pre-existing ESLint errors across multiple files (no-explicit-any, set-state-in-effect, exhaustive-deps) — not blocking builds
