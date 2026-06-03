# 🏠 HOMEBASE: MASTER PRODUCT SPECIFICATION & FULL-STACK IMPLEMENTATION BLUEPRINT

This document serves as the absolute, single-source-of-truth structural specification and architectural handoff file for **HomeBase**—a high-energy, premium asynchronous co-living synchronization ecosystem.


---

## 🎨 1. UI/UX Paradigm: "Porcelain Neon Glass" Style Guide

The visual design system of HomeBase is engineered to strip the friction and negativity away from domestic chore/bill management, transforming it into a high-energy, clear, and modern software environment.

### Global Palette, Gradients, and Canvas System

* **The Background Canvas:** Solid porcelain white base layer. Overlaid with massive, highly blurred interactive ambient radial spots that slowly track across the viewport. One radial point utilizes electric brand blue, a second uses vibrant mint green, and a third utilizes soft neon violet.
* **The Translucent Glass Panes:** Reusable layout panels containing all modular dashboard widgets. They feature semi-transparent white fills, heavy hardware-accelerated background blur, high color saturation boosts, explicit thin semi-transparent white outer borders, and soft, wide ambient box shadows.
* **Interactive Input Fields:** Form inputs are styled as translucent responsive elements. When active, they drop opacity backgrounds, transition borders smoothly to the brand blue accent color, and throw off a localized neon backing glow.
* **Typography Framework:** Structural headers use heavy display sans-serif characters with tight letter tracking. Sub-elements and status tags use medium text sizes with wide letter spacing. App branding titles and specific icon accents feature an organic cursive signature style to represent a welcoming domestic feel.

### Floating Tab Navigational Core

* **Component Structure:** A custom, fixed-position capsule nav bar hovering at the bottom margin of the viewport, centered horizontally and spanning the majority of the active width.
* **Scroll Intersections:** The bar relies on deep background blur styling so that any scrolling page dashboard elements pass cleanly behind the capsule container dynamically.
* **Active Path Indicators:** Activating a view route triggers an instant animated transformation, wrapping the icon in an energetic gradient background mesh that expands slightly with a neon glow effect.

---

## 🗄️ 2. Structural Database & Storage Specification

The application uses Supabase Postgres for relational tables, user sessions, and property image assets. Implement the backend system matching this textual layout data model exactly.

### Root Identity & Association Schema

* **Table: Households**
* Columns: Unique Identifier (UUID, primary key), Household Title (String text), Unique Alpha-Numeric Invitation Code (String, constrained to global uniqueness), Registration Timestamp.


* **Table: Profiles**
* Columns: User Identifier (UUID, primary key matching the core auth subsystem user entries), User Handle Name (String, globally unique), Avatar Asset URL String, Karma Credit Tracker (Integer, defaulting to baseline 100 points, cannot fall below zero), Active Assigned Household Identity (UUID reference to Households table, defaults to null), Presence Away State Flag (Boolean toggle, defaults to false), Last Modification Timestamp.


* **Table: Household Members Junction**
* Columns: System Identifier (UUID, primary key), Household ID Reference, Profile ID Reference, System Access Role (String Enumeration: Administrator, Tenant, Landlord), Member Join Timestamp. Enforce strict composite uniqueness across the combination of Household and Profile columns.


* **Table: User Presence Statuses**
* Columns: Profile ID Reference (Primary key, linking directly to the main profile entry), Active Status Type Selection (String Enumeration: Available, Sleeping, Quiet Hours / Studying, Work From Home, Away), Custom Context Text String, System Verification Timestamp.



### Scheduling & Marketplace Schema

* **Table: Chores Metadata**
* Columns: System Identifier (UUID, primary key), Household Association ID, Task Title Text, Detailed Description Text, Recurrence Interval Flag (String Enumeration: Twice Weekly, Weekly, Bi-Weekly, Monthly, Quarterly), Base Rotation Offset Seed Value (Integer index, defaults to zero), Creation Timestamp.


* **Table: Chore Calendar Assignments**
* Columns: Assignment Identifier (UUID, primary key), Chore Meta Link ID, Roster User Target ID, Explicit Calendar Due Date, Resolution Status Flag (String Enumeration: Pending, Completed, Swapped, Auctioned), Task Completion Timestamp.


* **Table: Karma Task Marketplace**
* Columns: Auction Identifier (UUID, primary key), Chore Assignment Target Link ID, Currency Cash Bounty Allocation (Numeric decimal scaled to cash precision), Point Karma Credit Bounty Allocation (Integer value), Open Active Status Flag (Boolean toggle, defaults to true), Listing Initiation Timestamp.



### Financial Ledgers Schema

* **Table: Core Master Transactions**
* Columns: Transaction Identifier (UUID, primary key), Household Link ID, Paying User Profile ID Link, Full Currency Amount Value (Numeric decimal scaled to cash precision), Descriptive Memo Text, Asset Expense Category Flag (String Enumeration: Rent, Groceries, Utilities, Shared Subscriptions, Miscellaneous Ad-Hoc), Ledger Logging Timestamp.


* **Table: Fractional Transaction Splits**
* Columns: Split Row Identifier (UUID, primary key), Parent Transaction Link ID, Debtor Roommate Profile ID Link, Assigned Currency Owed Fractional Allocation Amount, Debt Settlement Resolution Flag (Boolean toggle, defaults to false).


* **Table: Shared Utility & Delivery Subscriptions**
* Columns: Subscription Identifier (UUID, primary key), Household Link ID, Master Billing Title String, Total Global Monthly Recurring Cost Value, Owner Payee Profile ID Link, Subscription Initiation Timestamp.


* **Table: Subscription Roster Junction**
* Columns: Row ID (UUID, primary key), Shared Subscription Link ID, Enrolled Roommate Profile ID Link. Enforce strict unique constraints per subscription-to-roommate connection pair.



### Logistics, Communication, & Legal Agreements Schema

* **Table: Shared Shopping Cart Items**
* Columns: Item Identifier (UUID, primary key), Household Link ID, Sourcing User Profile ID Link, Item Description Title String, Numerical Quantity String text, Urgent Priority Flag (Boolean toggle, defaults to false), Purchase Resolution Flag (Boolean toggle, defaults to false), Entry Initiation Timestamp.


* **Table: System Notices & Broadcasts**
* Columns: Broadcast Identifier (UUID, primary key), Household Link ID, Author User Profile ID Link, Optional Display Title String, Mandatory Body Content Text String, Interaction Priority Type (String Enumeration: Instant Buzz Notification, Permanent Memo, Formal Landlord Notice), Broadcast Logging Timestamp.


* **Table: Document Read Acknowledgments**
* Columns: Acknowledgment Row ID (UUID, primary key), Target Broadcast Notice Link ID, Reviewing User Profile ID Link, Verified Read Confirmation Timestamp. Enforce absolute composite uniqueness over notice-user junctions.


* **Table: Common Area Space Bookings**
* Columns: Reservation Identifier (UUID, primary key), Household Link ID, Booking User Profile ID Link, Infrastructure Asset Resource Name String text, Precise Start Target Timestamp, Precise End Target Timestamp.


* **Table: Household Guest Logs**
* Columns: Log Identifier (UUID, primary key), Household Link ID, Responsible Host Profile ID Link, Visitor Metadata Name String, Planned Arrival Calendar Date, Planned Departure Calendar Date.


* **Table: Property Maintenance Tickets**
* Columns: Ticket Identifier (UUID, primary key), Household Link ID, Origin Reporting User Profile ID Link, Structural Issue Title String, Comprehensive Technical Description Text, Supabase Storage Bucket Public Image Asset URL, Ticket Status Pipeline Flag (String Enumeration: Open, Vendor Dispatched, Resolved), Incident Registration Timestamp.


* **Table: Shared Pet Well-Being Logs**
* Columns: Log Row ID (UUID, primary key), Household Link ID, Target Animal Name String, Completed Action Flag (String Enumeration: Morning Feed, Evening Feed, Daily Walk, Medication Administered), Executing User Profile ID Link, Action Timestamp.


* **Table: Onboarding Co-Living Agreements**
* Columns: Household Association ID (Primary Key link to Households), Fixed Weeknight Quiet Hours Window Start String, Fixed Weeknight Quiet Hours Window End String, Common Hygiene Standard Threshold Scale (Integer ranking from 1 to 5), Granular Visitor Overstay Threshold Rules Description Text, Last Adjustment Timestamp.


* **Table: House Co-Living Signatures**
* Columns: Signature ID (UUID, primary key), Household Agreement Link ID, Agreeing User Profile ID Link, Immutable Digital Execution Signature Timestamp. Enforce explicit composite unique constraints.


* **Table: Shared Physical Property Lockbox**
* Columns: Secret Identifier (UUID, primary key), Household Link ID, Critical Asset Variable Name Key String (e.g., Wi-Fi Credentials, Alarm Keypad Sequence, Master Water Valve Instructions), Confidential Payload Value Data String, Confidential Restriction Level Flag (Boolean toggle marking absolute data masking, defaults to false).



### Dedicated Storage Buckets

Configure an absolute public storage asset bucket titled `homebase-property-vault`. Apply strict folder routing structures separating assets cleanly: `/maintenance/` for technical issue photos, and `/inspections/` for time-stamped move-in property condition audits.

---

## ⚙️ 3. Mathematical Calculations & Algorithmic State Logic

The following formal procedural rules and structural equations must be coded by Claude Code directly into custom React hooks or utility functions to run calculations efficiently on the client.

### A. Procedural Chore Roster Assignment Equation

To render the correct assigned roommate on any calendar page view without hardcoding continuous calendar rows into database tables, evaluate the current active user mapping procedurally.

Calculate the target active user index within the household roster using a simple math equation: take the baseline core offset sequence value from the core chore metadata table, add the total number of whole calendar interval reset blocks elapsed between the chore's initial creation date and the target calendar view date, and calculate the remainder modulo the total count of unpaused household roommates who currently have their traveling away states set to false.

If a roommate toggles their personal traveling state to true, the frontend filter code must instantly strip their record array index position out of the math array structure, automatically re-distributing upcoming chores among the remaining roommates.

### B. Shared Financial Ledger Matrix Optimization Minimization

To clear outstanding domestic cross-balances cleanly without roommates sending multiple repetitive digital cash micro-transfers to one another, apply an automated balance reduction sequence:

1. Sum up the total value of all transaction split balances across the household database where payments remain un-settled.
2. Calculate an absolute net balance float value for every distinct roommate profile. A user's net cash position is equal to the total cash they paid out for bills minus the absolute fraction they owed across all recorded transactions.
3. Separate the results into a descending list of Creditors (positive net positions) and an ascending list of Debtors (negative net positions).
4. Run a matching loop that pairs the largest debtor directly with the largest creditor. Clear the smaller absolute debt amount between them, subtract that cleared sum from both users' balance trackers, update the net list positions, and loop until all net position vectors balance to zero.

### C. Automated Guest Overstay Utility Surcharge Adjustment

When a user logs a guest check-in window inside the Guest Logs table that spans longer than the maximum threshold rule established in the Co-Living Onboarding Agreement table (e.g., more than three consecutive nights), trigger a financial calculation adjustment:

Calculate the number of individual days the guest overstayed past the house allowance. Compute a dynamic utility modifier percentage equal to the total count of guest overstay days divided by the total number of calendar days in that current billing cycle month.

Multiply this modifier percentage against the variable utility expenses recorded for that month. Automatically add this extra fee as a single direct charge on the host's bill splitter table ledger, and credit it back to reduce the other roommates' bill allocations equally.

---

## 📂 4. Interface Component Blueprints

Configure the system views to follow this structural layout, ensuring the user interface remains clean, accessible, and modular.

### Custom Layout Component: Avatar Boundary Halo Frame

* **Visual Inputs:** Takes an avatar image string and a boundary status variable string.
* **Rendering Mechanics:** Wraps the profile avatar icon in an interactive concentric outer glass frame element.
* **Dynamic Glowing States:** If the presence status is set to Available, the outer frame border projects a soft glowing mint green aura. If set to Sleeping, it displays a deep neon purple backing glow. If set to Work From Home, it renders an electric bright blue aura. If set to Away, it shifts to a coral pink warning border with a low-pulse fading animation.

### Onboarding Multi-Step Validation Flow Layout

Configure a dedicated view component mapping a clean multi-step layout stack using an incremental step state controller tracking steps 1 through 6.

* **Step 1: Welcome Screen & Authentication Hook**
* Layout displays an ultra-bold cursive app signature logo centered over blurred pink and blue radial spot highlights. Includes direct single-tap social authentication cards and a clean fallback local login input block.


* **Step 2: Profile Persona Asset Mapping**
* Prompts user for their specific username handler name text. Displays an interactive image selector box that applies a circular glowing neon ring around the chosen photo to initialize their baseline daily Boundary Halo state.


* **Step 3: Household Gateway Branching Intersection Card**
* Renders two large stacked glass cards. Card Alpha features a bright blue setup button for creating a new household. Card Beta features a mint green layout that accepts an exact 6-digit alphanumeric invite token. Typing a valid code causes the layout to flash green with haptic verification feedback.


* **Step 4A: Co-Living Creator Rule Designer (Creator Path Branch)**
* Displays a list of interactive glass range sliders. Slider One defines weeknight quiet hours on a 24-hour scale. Slider Two sets a hygiene baseline score from 1 to 5. Slider Three configures the maximum night threshold rule for guests. Clicking completion inserts data into the Agreements table, generates a random alphanumeric invite token string, and advances to the dashboard.


* **Step 4B: Co-Living Onboarding Handshake Screen (Joiner Path Branch)**
* Fetches the active rules chosen by the household creator and displays them as clean parameters inside animated glass bubble elements.


* **Step 5: Handshake Digital Signature Sign-off**
* To finalize entry, the user must interact with a large neon handle button and swipe it completely across the bottom track layout. This action registers their user ID and timestamp directly into the Agreement Signatures matrix table before launching the main app view.



### The Comprehensive Main Dashboard Blueprint

The primary application interface uses a responsive layout grid layout dividing modules clearly.

* **Widget One: Immediate One-Tap Buzz alert Deck**
* Renders immediate, large action layout tiles. Clicking the Trash Buzz tile targets the roommate currently assigned to the trash chore with an assertive alert notification. Clicking the Quiet Buzz tile sends a house-wide notice requesting silence.


* **Widget Two: Collective Infrastructure Appliance Booker**
* Renders a continuous daily time-grid timeline tracking shared house appliances or parking bays. Users click open blocks on the timeline to claim a window, which tints that grid segment their personal profile neon color.


* **Widget Two: Shared Pet Care Timestamp Logger Grid**
* Displays high-frequency pet task buttons. Clicking a task stamps the action as complete with a real-time timestamp and user handle tag, keeping pet tracking completely accurate and transparent.


* **Widget Four: Shared Property Secure Lockbox View**
* Provides quick access to critical household information. Displays a scannable Wi-Fi configuration QR code card, alongside secure toggles that reveal gate codes, landlord phone numbers, or multi-step photo instructions for finding utility panels or main water shut-off valves during an emergency.



---

## 🚀 5. Explicit Claude Code Directive Checklist


 Review and ingest the full-stack architectural specification document provided for "HomeBase" above. Systematically execute the complete workspace build out adhering strictly to the following parameters:

1. ENVIRONMENT & BACKEND MAPPING: Initialize the global Supabase client instantiation file sourcing target environment injection parameters cleanly from a root .env wrapper.
2. SCHEMATIC DATABASE EXECUTION: Review the entire relational Postgres tables blueprint outlined in Section 2 textually. Provision the precise relational schema matching all columns, constraint logic, and foreign-key tables mappings exactly.
3. ALGORITHMIC MATHEMATICAL COMPILATION: Translate the procedural chore rotation math modulo logic, net-ledger minimization debtor matching sequence, and dynamic guest-overstay utility percentage calculator rules into clean custom React hooks.
4. UI RENDERING PIPELINE: Build the "Porcelain Neon Glass" component framework. Implement the complete multi-stage onboarding validation gate pipeline (Steps 1 through 6), the interactive sliding handshake sign-off workflow, the custom color-shifting avatar Boundary Halo frames, the one-tap Buzz alert deck, and the shared property lockbox interface exactly as specified.
5. REAL-TIME EVENT HOOKS: Ensure all database update states utilize active real-time listening channels to trigger instant interface updates across all active dashboard components. Do not leave placeholder shortcuts or un-implemented state methods.

```