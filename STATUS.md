# HomeBase — Feature Status

---

## ✅ Ready & Available

### Auth
- Email / password sign-up and sign-in
- Google and Apple OAuth handled by the LyfeWare portal (removed from this app's sign-in screen)
- **LyfeWare SSO** — "Sign in with LyfeWare" redirects to the LyfeWare auth portal; incoming hash tokens are injected via explicit `setSession()` with `detectSessionInUrl:false` so Supabase never double-processes the tokens (double-processing was rotating the refresh token and firing SIGNED_OUT, causing the persistent login loop)
- Auto-profile creation on sign-up — `lyfeware_unified_schema.sql` trigger now wrapped in EXCEPTION block (fixes "Database error saving new user" 500); base_name sanitized; client-side fallback in AuthContext creates the profile on SIGNED_IN if the trigger silently skipped
- Session persistence + auto token refresh
- Sign out
- Show/hide password toggle (eye icon) on sign-in and password-reset fields
- Input font-size 16px + removed backdrop-filter from input element + added -webkit-appearance:none and GPU layer to fix iOS Safari cursor displacement
- "Sync your LyfeWare apps!" tagline above the LyfeWare sign-in button
- **First-time spotlight tutorial** — 9-step live overlay that navigates to each feature page and spotlights the real UI element with a pulsing glow ring and animated tooltip; tap anywhere or press Next to advance; Skip/Finish both mark it done; "Rerun Tutorial" in More page resets it anytime

### Onboarding
- 6-step flow (Welcome → Profile → Household → Rules → Review → Sign)
- Create household (UUID pre-generated client-side to avoid RLS SELECT race; `created_by` column populated)
- Join household via 6-digit invite code with live validation flash (SELECT policy updated to allow any authenticated user to look up households by invite code)
- Co-living rule sliders (quiet hours, hygiene score, max guest nights); quiet hours displayed in 12-hour AM/PM format
- Joiner rule review screen with animated glass bubbles
- Swipe-to-sign digital agreement (mouse + touch)
- Step progress indicator dots

### Dashboard
- Ambient Porcelain Neon Glass canvas (animated radial orbs)
- Floating capsule NavBar with gradient active state
- Presence status selector (Available / Sleeping / Quiet Hours / WFH / Away) — setting Away also sets `profile.away=true` so chore rotation excludes that user automatically
- Roommate grid with Avatar Halo glow rings (colour changes per status); now uses `homebase_avatar_url ?? avatar_url` for consistency
- **Buzz Deck** — one-tap Trash Buzz and Quiet Buzz alerts (posts to Notices in real-time)
- **Appliance Booker** — hourly time-grid for shared resources, colour-coded per user; multi-hour bookings now correctly highlight all booked cells
- **Pet Tracker** — four action buttons with timestamp + username stamps
- **Lockbox widget** — masked secrets with reveal toggle

### Chores
- Add chores with recurrence (Twice Weekly / Weekly / Bi-Weekly / Monthly / Quarterly)
- Procedural rotation display (modulo algorithm, respects away state)
- Pending assignment list with mark-done (+10 karma) and auction actions
- Karma Marketplace — list and claim auctioned tasks (+karma reward); marketplace cards now show real chore title instead of "Available Task"
- Real-time updates via Supabase channel

### Finance
- Add transactions with category and auto equal-split
- Debt Minimizer — greedy creditor/debtor matching to reduce transfer count
- Net balance display per roommate
- One-tap "mark my debts paid" settlement
- Transaction history with category colour dots
- Real-time updates

### Notices
- Post memos, buzz notifications, and formal landlord notices
- Acknowledge / read receipts with unread dot indicator
- Real-time broadcast to all household members

### Bookings
- 7-day day selector
- Per-resource timeline grid (colour-coded per user); multi-hour bookings highlight all spanned cells; endHour auto-corrects when startHour advances past it; all time labels and dropdowns use 12-hour AM/PM format
- Add / delete own bookings
- Real-time updates

### Maintenance
- Report tickets with title, description, and photo upload (to Supabase Storage)
- Status pipeline: Open → Vendor Dispatched → Resolved
- Real-time updates

### Guests
- Log guest stays (name, arrival, departure) — validates departure > arrival
- Overstay detection against co-living agreement threshold
- **Guest Overstay Surcharge** — auto utility surcharge calculation (Section 3C algorithm)
- Surcharge alert cards
- Real-time updates via Supabase channel

### Shopping List
- Add items with quantity and urgent flag
- Check off / uncheck purchased items
- Real-time updates

### Pets
- Add multiple pets
- Four action buttons per pet with today's completion log
- Real-time updates

### Lockbox (full page)
- Add / delete secrets
- Restricted flag — hides value behind a reveal tap
- Invite code display on More page
- Real-time updates via Supabase channel

### Profiles & Karma
- Username + avatar selection (6 DiceBear presets)
- Karma counter (default 100, +10 per completed chore, +bounty per claimed marketplace task)
- Away toggle (removes user from chore rotation)

### Profile Photos
- **LyfeWare Global Photo** — Upload via "LyfeWare Photo" button in More page profile card; syncs across all apps
- **HomeBase-specific Photo** — Upload via "HomeBase Photo" button in More page profile card; overrides global photo only in HomeBase
- **Avatar display** — Profile card in More page and Dashboard header now show homebase_avatar_url ?? avatar_url with initials fallback

### LyfeWare Ecosystem Features
- **#2 Chore-Sync Anthems (write)** — `markDone()` in Chores.tsx writes a `chore_completed` event to `cross_app_activity` with `difficulty` and a `bpm_hint` (difficulty × 30 + 60) so Vinyl can queue a BPM-matched playlist
- **#8 Victory Fanfare (write)** — after marking the last pending chore done, writes `all_chores_done` to `cross_app_activity` (public, visible to household members); Vinyl can use this to trigger a celebration playlist
- **#13 Rent-Day Rewards (write)** — after "Mark My Debts Paid" settles all splits, Finance.tsx checks if any unsettled splits remain for the household; if zero remain, writes `all_bills_paid` to `cross_app_activity`
- **#14 Nutritional BPM (read + sort)** — Chores.tsx checks `cross_app_activity` for `nutrition_shortfall` events from Pantry (past 24h); if found, shows a "💪 Boost Mode" badge and sorts pending chore assignments with highest difficulty first

### Schema Migration (from per-app to unified LyfeWare schema)
- `households.title` renamed to `households.name` — all HomeBase queries updated
- `profiles.household_id` replaced by `profiles.active_household_id` — HouseholdContext, App.tsx, Onboarding, More, Dashboard all updated
- `agreement_signatures` insert in Onboarding now uses `profile.active_household_id`
- New profile columns added: `has_completed_homebase_tutorial`, `karma`, `away`, `vibe_tags`, `favorite_genres`, `hungry_settings`

### Database
- Full Postgres schema (all tables, all enums, all foreign keys) — now defined in unified `lyfeware_unified_schema.sql` at LyfeWare root
- Row-Level Security on every table, scoped to household membership via `is_household_member()` SECURITY DEFINER function
- `is_household_member()` helper function avoids RLS recursion
- Supabase Storage bucket (`homebase-property-vault`) for maintenance photos and inspection images

### Session 23 (2026-06-03)
**Features added:**
- **Tutorial example cards for empty-state features** — Tutorial.tsx now tracks `isFallback` state. When a feature element isn't found (e.g. empty chores/finance list), renders a visual demo card at the spotlight position showing example data instead of highlighting blank space. Each STEP has a `preview` string.
- **Add food items to Pantry from HomeBase** — Shopping.tsx `addItem()` now writes to `shopping_list` (Pantry's shared table) instead of `shopping_items`. Items added in HomeBase appear in Pantry's Shopping tab automatically and vice versa.
- **Confetti on tutorial completion** — `canvas-confetti` fires in `TutorialContext.complete()`. Colors match HomeBase's purple/indigo brand.
- **Rename household** — Edit (✎) button next to each household name in More.tsx opens an inline input field. Saves to Supabase `households.name` and updates local state.

### Session 22 (2026-06-03)
**Bug fixes:**
- **netlify.toml BOM + wrong base dir** — removed UTF-8 BOM from `netlify.toml` (and 18 other source files that also had BOMs) which caused Netlify's TOML parser to abort at line 9; corrected `base` from `"__HOMEBASEAPP__"` to `"roomies-app"` so Netlify builds from the correct subdirectory

### Session 21 (2026-06-02)
**Bug fixes:**
- **Invite link** — "Share Invite Link" button in Settings generates a shareable URL (`/welcome?invite=CODE`) using the Web Share API (with clipboard fallback); Onboarding auto-detects `?invite=` query param and pre-fills the code
- **Tutorial blank boxes** — steps for Utility Booker and Pet Tracker now route to `/bookings` and `/pets` respectively (those widgets were removed from home); tutorial anchor IDs added to those pages; tutorial description updated to include Inventory
- **LyfeWare name auto-fill** — Onboarding step 2 pre-fills username from `profile.display_name` or `profile.username`; a `useEffect` re-syncs if the profile loads after the component mounts (SSO flow)
- **Onboarding flash** — added early `return null` guard in Onboarding when `user && profile.active_household_id` is set, preventing a split-second flash before navigate fires
- **Chore rotation** — `addChore()` now sets `rotation_offset = chores.length % activeMembers.length` so each new chore starts at a different person; chores no longer pile on the same roommate
- **Auction button** — marketplace filter now uses `choreIds` (household's chore IDs) via `chore_assignments.chore_id` instead of filtering by pending `assignmentIds`; auctioned tasks now appear in the marketplace
- **Debt minimizer** — rewrote calculation to use split-based credit/debit (credit = sum of unsettled splits where you are the payer; debit = sum where you are the debtor); "Settle Up" panel now correctly shows who owes whom
- **Notice auto-dismiss** — acknowledged notices disappear from view after 5 minutes (tracked in local state with a 30-second ticker); prior-session acked notices remain visible
- **Pantry shopping items** — removed the blue PANTRY pill from shopping list items; real username fetched via `profiles!user_id(username)` join instead of showing "(Pantry)"
- **WiFi connect button** — removed the invalid `App-Prefs:WIFI` / `intent://settings` URL navigation that caused "Safari cannot open the page" error; connect button now copies password and shows an instruction message

**Features added:**
- **Time-based greeting** — Dashboard header shows "Good morning/afternoon/evening, [username]" based on current hour
- **Venmo integration** — Settings page has a Venmo section to save your Venmo username; Bills settle-up section shows a "Pay via Venmo" deep link for transfers where the recipient has a Venmo username linked
- **Inventory page** — new `/inventory` route in nav (Package icon): collapsible pantry section (reads from Pantry's `fridge_inventory` table for the same household) + household supplies section (Cleaning, Paper Goods, Toiletries, Laundry, Other) backed by new `household_inventory` table; requires migration `005_inventory_venmo.sql`
- **Tutorial updated** — added Inventory step (step 12); TUTORIAL_TOTAL updated to 12

### Session 20 (2026-06-02)
**Bug fixes:**
- **Nav logo duplication** — removed the fixed "HomeBase" Pacifico span that duplicated the Dashboard header logo in the top-left; the "HomeBase" text in the Dashboard header now opens the nav when tapped (dispatches `homebase-open-nav` custom event); on desktop a hamburger icon button (hidden on mobile via CSS media query) replaces the fixed text trigger
- **Chore calendar empty** — `addChore()` now auto-generates `chore_assignments` rows for the next 30 days at the correct recurrence interval, assigned to the right rotation person; calendar now shows entries immediately after a chore is added

**Features added:**
- **Done button on all chores** — the "This Week's Rotation" list now shows a ✓ button for each chore currently assigned to the logged-in user; taps `markDone()` directly without navigating to Pending Tasks
- **Chore Calendar on Home** — a 7-day scrollable calendar showing upcoming assignments is now displayed on the Dashboard (replaces Utility Booker)
- **Recent Bills on Home** — last 3 transactions shown as a summary widget on the Dashboard
- **Pending Maintenance on Home** — open maintenance tickets are listed on the Dashboard (replaces Pet Care)
- **Utility Booker removed from Home** — moved to the Bookings page only
- **Pet Care removed from Home** — moved to the Pets page only

### Session 19 (2026-06-02)
**Bug fixes:**
- **Lockbox TS6133** — removed unused `isRevealed` variable (line 166 of Lockbox.tsx); the `hidden` variable already covered the same logic; fixes the Netlify build error

**Features added:**
- **Household type choice on creation** — when creating a household in onboarding (Step 4A), users now see two options: "Shared with Pantry" (default — one household used by both apps) or "HomeBase Only" (a separate Pantry pantry household is auto-created and set as `hungry_household_id` so Pantry uses a different context); the toggle uses blue/purple accent colours matching each app

### Session 18 (2026-06-02)
**Bug fixes:**
- **Nav: HomeBase glass pill removed** — the top-left glass capsule button replaced with a plain "HomeBase" text tap target (Pacifico font, no button styling); swipe-right already handles nav open on mobile; cleaner look
- **Delete Household modal** — clicking 🗑 on a household now opens a centred confirmation modal overlay ("Are you sure you want to delete this household?") instead of cluttering the household card with inline "Delete All" / "Cancel" buttons

**Features added:**
- **WiFi Connect button always visible** — the "📋 Copy Password" and "📡 Connect" buttons on WiFi lockbox entries now show for all non-hidden WiFi items (not only when the entry is revealed); non-restricted WiFi entries show the connect buttons immediately; restricted entries show them after tap-to-reveal; the redundant sidebar copy button is hidden for WiFi items since the inline copy button serves the same purpose

### Session 17 (2026-06-02)
**Bug fixes:**
- **RLS INSERT fix** — `is_household_member()` now has `SET search_path = public` to ensure `auth.uid()` resolves correctly inside SECURITY DEFINER context; all household-scoped INSERT policies now have explicit `WITH CHECK`; migration `004_fix_rls.sql` must be run in Supabase SQL Editor
- **Auto-repair household membership** — `HouseholdContext` detects when `active_household_id` is set but user is missing from `household_members` and re-inserts the row, restoring write access without a manual DB fix
- **Custom pet chores** — `pet_logs.action` changed from `pet_action` enum to `text`, allowing any chore name (including user-defined custom chores) to be saved to the database
- **Nav: HomeBase logo replaces hamburger** — 3-line hamburger icon removed; a glass pill showing "HomeBase" (Pacifico font) in the top-left now opens/closes the drawer; swipe-right gesture now works from anywhere on screen (removed `startX < 30` restriction)

**Features added:**
- **Delete Household** — household owners (creators) now see a 🗑 button next to the household in Settings; tapping confirms then permanently deletes the household and all its data (cascade)

### Session 16 (2026-06-02)
**Features added:**
- **Shared Grocery List with Pantry** — Shopping page cross-reads from Pantry's `shopping_list` table for the same household. Pantry items appear with a PANTRY badge. Toggling and deleting Pantry items updates the `shopping_list` table. Real-time subscription covers both tables.
- **Floating Pantry-style Nav** — NavBar replaced with a Pantry-identical floating glass drawer: hamburger button (fixed top-left), backdrop overlay, swipe-right-from-edge gesture, swipe-left-to-close, Lucide icons, glass/blur styling matching Pantry. CSS sidebar and `app-content` offset removed.
- **Tutorial: ecosystem steps** — 2 new tutorial steps added: Shared Grocery List with Pantry, Chore Sync Anthems with Vinyl. `TUTORIAL_TOTAL` updated to 11.
- **Nav description update** — tutorial step for Navigation updated to reference the new floating drawer mechanism.

---

## 🔜 Can't Be Added Yet

| Feature | Reason |
|---|---|
| **Apple Sign In** | Requires an Apple Developer account ($99/yr), a registered App ID with Sign In with Apple capability, and a native iOS bundle ID. The web OAuth flow also requires a Services ID and private key configured in Supabase. Add once the iOS app is registered on App Store Connect. |
| **Push Notifications (iOS)** | Requires APNs (Apple Push Notification Service) certificate/key, a native app container, and entitlements. Web push via VAPID is possible but not supported on iOS Safari without a PWA install prompt. Add alongside the iOS app target. |
| **Push Notifications (Android)** | Requires FCM (Firebase Cloud Messaging) integration and a native Android container or a PWA with VAPID keys. Add when an Android build target is set up. |
| **Native Camera / QR Scanner** | The lockbox Wi-Fi QR code card and maintenance photo capture work via browser `<input type="file">` on desktop. On iOS a native camera API (`AVFoundation`) gives a far better experience. Add when wrapped in a native shell (e.g. Capacitor or React Native). |
| **Haptic Feedback** | Spec calls for haptic feedback on invite-code verification (Step 3). `navigator.vibrate()` is blocked on iOS Safari. Requires native `UIImpactFeedbackGenerator`. Add with iOS wrapper. |
| **Biometric / Face ID Auth** | Logical companion to Apple Sign In for re-auth on lockbox reveals and agreement signing. Requires `LocalAuthentication` framework — native iOS only. |
| **Real-time Notification Badge (app icon)** | iOS home-screen badge count requires APNs + a native app. Not possible in a browser tab. |
| **Offline Mode** | Full offline-first support requires a service worker with background sync and a local cache strategy (e.g. IndexedDB + Supabase offline queue). Currently the app requires an active connection. Add as a dedicated PWA hardening pass. |
| **Landlord Portal (separate role view)** | The `Landlord` role is stored in the DB but currently sees the same UI as Tenants. A dedicated landlord dashboard (maintenance overview, formal notice broadcast, inspection uploads) is scoped for a future release. |
| **Move-in Inspection Photo Audit** | The `/inspections/` folder in the storage bucket is reserved but the inspection flow (timestamped photo grid, room-by-room checklist) is not yet built. Blocked on the Landlord Portal above. |
| **In-App Payments (cash bounties)** | The `cash_bounty` field on karma marketplace listings is stored but no payment processor is wired up. Requires Stripe (web) or StoreKit (iOS) integration and legal/compliance review before handling real money. |
| **Recurring Calendar Export (.ics)** | Exporting chore rotation to Apple Calendar / Google Calendar requires generating iCalendar files or using the Google Calendar API. Requires OAuth scopes beyond the current auth setup. |
| **Email / SMS Notifications** | Buzz alerts currently post to the in-app Notices table only. Sending real emails or SMS requires a transactional email provider (Resend, SendGrid) and/or Twilio wired into Supabase Edge Functions. |
| **Scheduled Local Notifications** | Reminders like "It's your turn for trash tonight" or "Quiet hours start in 30 min" require `UNUserNotificationCenter` (iOS) or `AlarmManager` (Android) to fire while the app is closed. Not possible from a browser tab. |
| **Background Data Refresh** | When the app is closed or backgrounded on iOS, no real-time Supabase channel updates are received and no data is synced. Requires `BGAppRefreshTask` (iOS) or a WorkManager job (Android) inside a native wrapper. |
| **Deep Links / Universal Links** | A household invite link (e.g. `homebase.app/join/ABC123`) that opens the app directly to the join flow requires Associated Domains entitlement + `apple-app-site-association` file on the server. Web fallback is possible but the in-app deep-link handling needs a native router hook. |
| **Geofence Auto-Away Mode** | Automatically toggling your presence to "Away" when you leave the home's GPS radius requires `CLLocationManager` always-on permission (iOS) or a Geofence API (Android). iOS Safari kills location access when the tab is not in the foreground. |
| **iOS Home Screen Widgets** | A glanceable widget showing today's assigned chores, outstanding balance, or next appliance booking requires WidgetKit (iOS 14+). Web apps cannot place widgets on the home screen. |
| **Siri Shortcuts** | Voice commands like "Hey Siri, log the dog walk" or "Hey Siri, add milk to the shopping list" require `INIntent` / `AppIntents` framework — native iOS only. |
| **Native Share Sheet** | Sharing the household invite code via iMessage, AirDrop, WhatsApp etc. using the native iOS share sheet requires `UIActivityViewController`. The Web Share API (`navigator.share`) is available in Safari but restricted and cannot target specific apps. |
| **Face ID / Touch ID for Lockbox** | Re-authenticating before revealing restricted lockbox secrets with Face ID or Touch ID requires `LocalAuthentication` — native iOS only. WebAuthn is a partial browser alternative but is not the same UX. |
| **Wi-Fi QR Code Auto-Configure** | Spec calls for a scannable Wi-Fi QR card in the lockbox. Generating a QR code image is possible in the browser (can be added now with a library). Tapping it to auto-join the Wi-Fi network requires the `NEHotspotConfiguration` API — native iOS only. |
| **App Store Distribution** | The app cannot be listed on the App Store or distributed via TestFlight as a web app. Requires a native wrapper (Capacitor, React Native, or Swift) with a valid provisioning profile and App Store Connect submission. |
| **Contact Picker for Inviting Roommates** | Letting users select a contact to send an invite requires `CNContactPickerViewController` (iOS) or Contacts API (Android). The browser Contacts Picker API exists but is limited and not supported on iOS Safari. |
| **In-App Review Prompt** | Prompting users to rate the app in the App Store at a natural moment (e.g. after first debt settlement) requires `SKStoreReviewController` — native iOS only. |
| **Spotlight Search Integration** | Indexing chores, transactions, and roommate names so they appear in iOS Spotlight search results requires `CSSearchableItem` / `CoreSpotlight` — native iOS only. |
