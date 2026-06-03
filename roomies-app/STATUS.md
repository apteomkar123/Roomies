# HomeBase — Feature Status

A living document tracking what's shipped, what works, and what's pending.

---

## ✅ Implemented & Working

### Auth
- Email / password sign-in and sign-up
- Show/hide password toggle (eye icon) on password fields
- Forgot password (email reset link)
- **Sign in with LyfeWare** — "Sync your LyfeWare apps!" tagline above button; redirects to authlyfeware.netlify.app SSO portal, returns with hash tokens injected into Supabase session
- Google and Apple sign-in removed (replaced by LyfeWare SSO)
- Client-side profile row creation fallback (for when DB trigger fails silently on signup)
- Password reset screen (redirected from Supabase reset email)
- **Auth loading bug fix** — resolved infinite spinner; SSO null `INITIAL_SESSION` handled
- **Merge LyfeWare Account** — "Merge LyfeWare Account" card in More/Settings. Shows connected sign-in identities; "Link Google Account" button calls `supabase.auth.linkIdentity({ provider: 'google' })` to link Google to the current account so users can sign in from either method

### Onboarding
- Multi-step flow: sign-in/sign-up → profile setup (username, avatar) → create or join a household
- **Auto-import LyfeWare profile photo** on step 2 — shows "import or change" dialog automatically
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
- **Per-household resources** — hardcoded default utilities removed; each household starts with a clean slate and adds its own bookable resources (Washing Machine, Parking Bay, BBQ, etc.) via the "Manage" panel; stored in `household_resources` table
- **Tap empty block to book** — clicking any unoccupied hour slot in the timeline now opens the booking form pre-filled with that resource and hour; hover highlight indicates clickability
- Delete own booking by tapping it
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

### Inventory
- Household supplies tracking (Cleaning, Paper Goods, Toiletries, Laundry, Other categories)
- Add / remove supply items manually
- **Non-food items auto-sync from Pantry** — when a user scans a receipt or barcode in the Pantry app and a non-food item is detected, it is automatically inserted into HomeBase's `household_inventory` table; a violet toast notification "X non-food items added to HomeBase inventory" appears in Pantry

### Shopping
- Shared household shopping list
- Add / remove items, mark as bought
- **Pantry sync** — adding items fires a cross_app_activity event to sync with Pantry

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
- **Multiple households** — view all households, switch active, join a new one via invite code, or create a new one; switches fire cross_app_activity for Pantry sync
- Sign out
- Re-run Tutorial

### Navigation (Left Sidebar)
- **Left sidebar nav** — replaced bottom capsule with a fixed left sidebar matching the Pantry app style; shows icons + labels on desktop, icons only on mobile (< 640px)
- **All pages in sidebar** — Shopping, Pets, Guests, Lockbox, Karma all directly accessible from nav (no longer hidden under More)
- **Unread badges** — red badge on Notices (unread count) and Maintenance (open tickets), auto-updated via Supabase Realtime

### Bills (formerly Finance)
- Renamed "Finance" to "Bills" with "Split bills" subheading throughout nav and page
- **Delete transaction** — transaction author can delete their own transactions (with splits)

### Chores
- **Delete chore** — delete button on each chore in the rotation view; cascades to assignments

### Notices
- **Delete notice** — notice author can delete their own notices
- **Save error display** — errors from Supabase shown inline instead of silent failure

### Maintenance
- **Delete ticket** — ticket reporter can delete (take back) their work order
- **Save error display** — errors from Supabase shown inline

### Pets
- **Delete pet** — "Remove Pet" button removes pet and its custom chores from localStorage
- Pet names persisted to localStorage per household so they survive page reloads

### Lockbox
- **Key type selector** — choose WiFi, Gate Code, Alarm Code, Door Code, Garage Code, or General when adding a key
- **WiFi-specific form** — SSID and password fields shown when WiFi type selected
- **Connect button** — copies password + routes to iOS/Android WiFi settings
- Icon auto-detected per key type in list view

### Settings (More page)
- Renamed page heading to "Settings"
- **Leave household** — "Leave" button with confirmation on each household; switches active household to next available
- **Link LyfeWare** — replaced "Link Google Account" (which errored) with "Link LyfeWare Account" button linking to authlyfeware.netlify.app
- Removed secondary page grid (Shopping, Pets, etc.) — all now in sidebar nav directly

### Readability
- Removed default mobile tap-highlight across all elements
- Darker gradient + text-shadow on active nav items for better contrast

---

### Bills (Finance)
- **Venmo button fix** — Venmo pay link now shows correctly for debtors; added "You're all paid up!" badge when user has no debts; added "You're owed money" card showing user's Venmo to share when they're a creditor; added hint for debtors when creditor hasn't set Venmo
- **Mark as paid fix** — button now disabled/replaced with "You're all paid up!" when user has no debts; added error display and loading state to prevent silent failures

### Dashboard
- **Tappable Bills section** — tapping the "Recent Bills" widget navigates to /finance
- **Tappable Lockbox section** — tapping the "Property Lockbox" widget navigates to /lockbox; Reveal buttons still work in-place without navigating

### Chores
- **Intensity-based assignment** — new chores auto-detect difficulty (1–5) from their name (vacuuming=3, bathrooms=4, trash=2, etc.); intensity shown as a badge in the add form; workload-balanced assignment spreads harder chores to members with lower current load
- **Avatar reassign** — tapping the assignee's avatar in "This Week's Rotation" opens an inline member picker to reassign all pending occurrences of that chore

---

## ❌ Not Yet Implemented / Known Gaps

- Push notifications for notices, maintenance updates, bookings
- Deep link sharing for individual resources
- Native mobile app (iOS / Android) — Wi-Fi auto-connect is best-effort on web
- Google / Apple SSO (intentionally removed; LyfeWare SSO used instead)
- Pre-existing ESLint errors across multiple files (no-explicit-any, set-state-in-effect, exhaustive-deps) — not blocking builds
