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
- **Auth loading bug fix** — resolved infinite spinner: 5-second timeout now stays alive until `fetchProfile` completes (handles degraded-network hangs); SSO null `INITIAL_SESSION` early-returns so it can't wipe user state set by a concurrent `SIGNED_IN` event

### Onboarding
- Multi-step flow: sign-in/sign-up → profile setup (username, avatar) → create or join a household
- Avatar picker with DiceBear presets
- Invite-code based household joining
- iOS cursor glitch fix (disabled autocorrect/autocapitalize on inputs)

### Tutorial
- **Interactive tutorial** — runs automatically on first login after onboarding; guides user through each feature by navigating to routes and spotlighting UI elements with an animated halo and message bubble
- Skip / dismiss marks tutorial complete
- Re-run Tutorial button in Settings (More page)
- Confetti on finish

### Dashboard
- Roommate presence status (Available / Sleeping / Quiet Hours / WFH / Away) — real-time via Supabase Realtime
- Resource booking widget (today's bookings shown)
- Pet log quick actions widget
- Lockbox secret reveal widget
- "Buzz in" button for common entry intercom

### Chores
- Chore list with rotation tracking (`useChoreRotation` hook)
- Assign chores to household members
- Mark chores complete

### Finance
- Household expense tracking
- Debt minimization algorithm (`useDebtMinimizer` hook)
- Guest surcharge calculation (`useGuestSurcharge` hook)

### Notices
- Household notice board (post and view notices)
- Real-time updates via Supabase Realtime

### Bookings
- Shared resource booking (Washing Machine, Dryer, Parking Bay A/B, BBQ)
- Conflict detection
- Real-time updates

### Maintenance
- Maintenance request submission and tracking
- Status workflow (open → in-progress → resolved)

### Lockbox
- Shared household secrets / passwords
- Reveal toggle per secret

### Guests
- Guest visit log (name, date, duration)
- Tracks who invited the guest

### Shopping
- Shared household shopping list
- Add / remove items, mark as bought

### Pets
- Pet care log (Morning Feed, Evening Feed, Daily Walk, Medication)
- Per-pet tracking within a household

### Karma Leaderboard
- `/karma` page showing ranked household members by karma score
- Medal icons for top 3 positions
- "How to earn karma" guide panel

### More / Settings
- Navigation hub for secondary pages
- Sign out
- Re-run Tutorial

---

## ❌ Not Yet Implemented / Known Gaps

- Push notifications for notices, maintenance updates, bookings
- Deep link sharing for individual resources
- Native mobile app (iOS / Android)
- Google / Apple SSO (intentionally removed; AppWare SSO used instead)
- Pre-existing ESLint errors across multiple files (no-explicit-any, set-state-in-effect, exhaustive-deps) — not blocking builds but flagged for cleanup
