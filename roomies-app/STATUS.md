# HomeBase — Feature Status

A living document tracking what's shipped, what works, and what's pending.

---

## Session 36 (2026-06-23) — Bug Fixes

| Feature | Status | Notes |
|---|---|---|
| **Notices dismiss on acknowledge** — acknowledged notices now disappear immediately and stay gone across sessions | ✅ Fixed | `Notices.tsx` — removed 5-min session timer; `visibleNotices` now simply filters out any notice in `readIds` |
| **Household join syncs Pantry** — joining a household during onboarding always writes `active_household_id` to `auth.user_metadata` | ✅ Fixed | `Onboarding.tsx` — removed the `if (!existingIds.includes)` guard; `updateUser` now always fires so Pantry picks up the switched household |

---

## Session 35 (2026-06-23) — LyfeWare Ecosystem Features

| Feature | Status | Notes |
|---|---|---|
| **LyfeWare Feed** — live household activity feed in Dashboard | ✅ Complete | `Dashboard.tsx` — cross_app_activity scoped to household members |
| **Weekly Digest widget** — groceries spent + chores done this week in Dashboard | ✅ Complete | `Dashboard.tsx` — GlassPanel with loadDigest useCallback |
| **@mentions in Notices** — `@username` in notice body fires `mention_notification` to cross_app_activity | ✅ Complete | `Notices.tsx` — post() detects @handles and writes events for each matched household member |
| **Recipe Nights calendar** — upcoming scheduled recipe nights from Pantry shown in Dashboard | ✅ Complete | `Dashboard.tsx` — loadRecipeNights queries recipe_nights table; shows next 14 days |
| **Household avatar** — shows household photo in Dashboard header | ✅ Complete | `Dashboard.tsx` — household.avatar_url displayed next to household name |
| **Household.avatar_url type** — TypeScript type updated | ✅ Complete | `types/index.ts` — Household interface now has avatar_url field |

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
- **Add Food Item from HomeBase** — type toggle (Supply / Food Item) in the add form; Food Item mode shows food categories + optional expiry date and inserts into `fridge_inventory` (Pantry's table), syncing directly to Pantry's fridge view for the household
- **RLS fix** — migration `007_fix_cross_app_rls.sql` recreates `household_inventory` INSERT/UPDATE policies using the correct explicit `WITH CHECK` pattern; no more "row violates row-level security" errors

### Shopping
- Shared household shopping list
- Add / remove items, mark as bought
- **Pantry sync** — all HomeBase-added items write to `shopping_list` (same table as Pantry); Pantry items appear in HomeBase's shopping page with real usernames; real-time via Supabase Realtime
- **Unified shopping_list** — `load()` reads from `shopping_list` as the single source of truth for all shopping items; legacy `shopping_items` rows (pre-Session 23) shown as fallback and deduplicated by title
- **Per-item notes** — tap 💬 on any pending item to add/edit a note ("get the organic one", "we have half a bag left"); stored in `shopping_list.note`; syncs in real-time with Pantry; amber colour when note exists; click the note text to re-edit; legacy shopping_items rows don't support notes
- **Error display** — failed inserts now show an inline error message instead of silently doing nothing

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
- **leaveHousehold fix** — always updates both `profiles.active_household_id` AND `auth.user_metadata` to the correct next household, regardless of which household was currently marked active in stale profile state
- Sign out
- Re-run Tutorial

### HouseholdContext / Core Sync
- **Fallback household discovery** — if `profiles.active_household_id` is null (e.g. after household deletion or DB inconsistency), HouseholdContext queries `household_members` to find any membership, self-heals `profiles.active_household_id`, and updates `auth.user_metadata`; mirrors the same fallback that exists in Pantry's UserContext

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

### CodeCheck Bug Fixes
- **Finance $0 validation** — `addTransaction()` now guards `parseFloat(amount) <= 0`; previously a "$0" entry would silently insert a zero-amount transaction
- **Chores reassign picker** — inline member picker in "This Week's Rotation" now filters to non-Away members only; previously Away members appeared in the list and selecting one would silently skip updating `rotation_offset`, causing a future rotation mismatch
- **Chores pending tasks assignee** — Pending Tasks now shows the assignee's username for other members' tasks (e.g. "Alex · Due Jun 12"); previously only showed the due date with no indication of whose task it was
- **Shopping realtime filter** — Supabase Realtime subscriptions for `shopping_items` and `shopping_list` now include `household_id` filter; previously any household's shopping changes would trigger a reload on all households
- **Guest $0 surcharge filter** — `useGuestSurcharge` now filters out zero-amount results; prevents a "+$0.00 utility surcharge" from appearing when a guest overstays but no utility bills have been entered yet

### Session 30 — Cross-App Sync Deep Fix + Audit (2026-06-18)
- **deleteHousehold auth.user_metadata cleanup** — `deleteHousehold()` in `More.tsx` now fetches current user metadata, removes the deleted household ID from `household_ids`, picks a new `active_household_id`, and calls `supabase.auth.updateUser()`. Previously the stale household ID remained in Pantry's metadata, causing Pantry to fetch a deleted household and show no active household.
- **Profile type: hungry_household_id** — Added `hungry_household_id?: string | null` to the `Profile` interface in `src/types/index.ts`. The field was already written in `Onboarding.tsx` but was missing from the type definition, causing a TypeScript mismatch.
- **Audit verified correct**: `fridge_inventory` insert uses `user_id` (correct per schema), `supabase.removeChannel()` is valid in Supabase JS v2, all Realtime subscriptions are household-filtered, all table names match schema.

### Session 27 — Cross-App Household Sync Fix
- **Household sync with Pantry** — Roomies now writes household changes to `auth.user_metadata` (fields `household_ids`, `active_household_id`) whenever a household is created, joined, switched, or left. Previously only `profiles.active_household_id` was updated, so Pantry (which reads from `user_metadata`) would not see households created or joined in HomeBase. Fixed in `Onboarding.tsx` (`handleFinishCreate`, `handleFinishJoin`) and `More.tsx` (`switchHousehold`, `joinNewHousehold`, `createNewHousehold`, `leaveHousehold`).

### Session 26 — Guest Surcharge Removed
- **Guest surcharge feature removed** — `useGuestSurcharge` hook deleted; all surcharge UI removed from Guests page (overstay alert panel, Overstay badge, red card border, max-nights subheading, transaction/agreement queries); Guests page now shows only the visit log with name, dates, nights, and host

### Session 25 QA Bug Fixes
- **Bookings end-time 12h format** — end-time hour dropdown now uses `fmt12()` (12-hour AM/PM) instead of 24-hour `HH:00` format, matching the start-time dropdown
- **Guests delete** — hosts can now delete their own guest log entries via a ✕ button on each log card
- **Inventory fridge realtime** — `fridge_inventory` table now subscribed to Supabase Realtime alongside `household_inventory`; food items added in Pantry reflect immediately without manual refresh
- **Pets cross-device name sync** — pet name discovery now queries all-time pet logs (not just today's), so roommates see all household pets even when no actions were logged today
- **Onboarding photo overwrite fix** — uploading a HomeBase-specific photo no longer overwrites the global LyfeWare `avatar_url`; homebase URL stored only in `homebase_avatar_url` when a global avatar already exists
- **Tutorial mobile spotlight fix** — `find()` now checks element dimensions (`width > 0 && height > 0`) before accepting it as found; prevents a broken 0×0 spotlight when `tut-nav-open` (hamburger) is CSS `display:none` on mobile; falls back to preview card instead

### Session 31 — 15 New Features

#### Finance (Bills page)
- **Recurring bills** — define monthly/weekly/quarterly recurring expenses (rent, utilities, subscriptions); tap "Generate Now" to create the transaction + split for the current period; `recurring_bills` table
- **Rent tracker tab** — dedicated "Rent" tab showing who's paid rent this month (from Rent-category transactions) and who hasn't; per-person status with amounts
- **Custom split ratios** — when "Split equally" is unchecked, show each roommate with an editable amount field; validates total doesn't exceed bill amount
- **Subscriptions tab** — log Netflix, Spotify, Disney+, etc. with monthly cost and which members are on the plan; shows monthly total and per-person share; `subscriptions` + `subscription_members` tables (pre-existing, now UI-complete)

#### Chores page
- **Chore swap requests** — tap "⇄ Swap" on any of your pending chore assignments; select a roommate and send an optional message; they see a "Swap Requests for You" panel and can Accept/Decline; on accept, assignments are re-assigned to each other; `chore_swap_requests` table
- **Seasonal / one-off tasks** — separate section at the bottom of Chores; anyone can add tasks like "Change furnace filter" with a karma reward; any roommate can claim and complete; `seasonal_tasks` table

#### Dashboard page
- **Quiet hours countdown widget** — live timer showing time until quiet hours start (or end if currently in quiet hours); pulls from `coliving_agreements`; updates every minute
- **Lease countdown widget** — shows days until lease ends with urgency styling (red if ≤ 60 days); links to lease end date from `lease_info` table
- **House rules quick-reference card** — surfaced from the co-living agreement: quiet hours, hygiene score, and guest policy in a compact grid

#### Karma page
- **Completion streak badges** — computes consecutive weeks (up to 8 weeks lookback) each member has completed ≥1 chore; badges: ✓ green (1w), ⚡ purple (2w+), 🔥 amber (4w+)

#### More / Settings page
- **Lease settings** — "Set Up" / "Edit" button to configure lease start, end date, and monthly rent; saved to `lease_info` table; displayed on Dashboard as countdown
- **Emergency contacts card** — each roommate can add their own emergency contacts (name, relationship, phone, email); all members of the household can see them; `emergency_contacts` table

#### Maintenance page
- **Incident reports tab** — second tab alongside Work Orders; log safety/property incidents (broken window, water leak) with title, description, severity (Low/Medium/High/Emergency), and optional photo; timestamped; can be marked Resolved; `incident_reports` table

#### New pages
- **Packages page** (`/packages`) — log expected deliveries with carrier, tracking number, expected date; "Mark Arrived" alerts the house; "Picked Up" marks as claimed; filter by status; real-time sync; `packages` table
- **House Calendar page** (`/calendar`) — schedule house events with title, description, date, time; "Next 30 Days" mini-calendar at top; upcoming vs. past sections; event type auto-detected with emoji; `house_events` table
- **Move-In Checklist page** (`/move-in`) — add rooms, then log items per room with condition (Excellent/Good/Fair/Poor/Damaged) and notes; damage summary (issues count); deposit-dispute evidence; `move_in_rooms` + `move_in_items` tables

#### Navigation
- Added **Calendar** and **Packages** and **Move-In** to the left sidebar nav
- Updated tutorial to include Packages, Calendar, Seasonal Tasks steps

#### Database
- Migration `009_new_features.sql`: `recurring_bills`, `chore_swap_requests`, `packages`, `house_events`, `seasonal_tasks`, `move_in_rooms`, `move_in_items`, `lease_info`, `emergency_contacts`, `incident_reports` — all with RLS policies

---

## ❌ Not Yet Implemented / Known Gaps

- Push notifications for notices, maintenance updates, bookings
- Deep link sharing for individual resources
- Native mobile app (iOS / Android) — Wi-Fi auto-connect is best-effort on web
- Google / Apple SSO (intentionally removed; LyfeWare SSO used instead)
- Pre-existing ESLint errors across multiple files (no-explicit-any, set-state-in-effect, exhaustive-deps) — not blocking builds
