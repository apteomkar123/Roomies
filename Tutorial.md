# 🚀 HomeBase: First-Time User Tutorial Implementation

This document contains the instructions and database requirements for building the interactive onboarding tutorial for HomeBase.

## 🏁 Introduction Quote
The tutorial must start with this exact text:
> "Everyone skips tutorials, but you won't want to skip this one. You can do a lot with this app."

## 💾 Database Setup (Supabase SQL)
Run this query in your Supabase SQL Editor to prepare the database for tutorial tracking:

```sql
-- Add tutorial completion tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_completed_tutorial BOOLEAN DEFAULT FALSE;

-- Ensure RLS allows users to update their own tutorial status
-- Note: If the policy already exists, you can skip this part
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can update their own tutorial status'
    ) THEN
        CREATE POLICY "Users can update their own tutorial status" 
        ON public.profiles 
        FOR UPDATE 
        USING (auth.uid() = id) 
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;
```

## 🛠️ Implementation Logic
1.  **Trigger:** Show only if `profiles.has_completed_tutorial` is `false`.
2.  **Persistence:** On completion/skip, update `has_completed_tutorial` to `true`.
3.  **Visuals:** Use the "Porcelain Neon Glass" aesthetic (backdrop blur, neon borders, semi-transparent backgrounds).

## 🗺️ Feature Coverage Guide

### 1. The Dashboard & Presence
*   **Avatar Halo:** Explain that the glow color (Mint/Purple/Blue/Coral) indicates roommate status (Available/Sleeping/WFH/Away).
*   **Presence Selector:** Show how to toggle status. Emphasize that "Away" mode automatically pauses chore assignments.
*   **Buzz Deck:** Introduce one-tap alerts (Trash/Quiet) that send instant notifications to roommates.

### 2. Shared Logistics
*   **Appliance Booker:** Point out the hourly grid for the washing machine or parking. Explain how to claim slots.
*   **Pet Tracker:** Show the action buttons (Feed/Walk) and explain that every tap is timestamped with the user's name.
*   **Lockbox Widget:** Explain how to reveal masked secrets like Wi-Fi codes or gate sequences.

### 3. Smart Chores & Karma
*   **Modulo Rotation:** Explain that chores rotate fairly based on a mathematical formula so no one gets stuck with the same task.
*   **Karma Marketplace:** Show how to "Auction" a chore for Karma or cash bounties when busy.
*   **Karma System:** Highlight the Karma counter—completing chores earns +10 points.

### 4. Finance & Transactions
*   **Debt Minimizer:** Explain the "Greedy Matching" algorithm. It reduces the number of Venmo/CashApp transfers needed to settle the whole house.
*   **One-Tap Settlement:** Show how to mark debts as paid instantly.

### 5. Advanced Rules & Guests
*   **Guest Logs:** Explain how to log visitors.
*   **Overstay Surcharge:** Mention that guests staying past the house limit (e.g., 3 nights) trigger an automatic utility surcharge calculation.
*   **Maintenance Tickets:** Show how to report broken items with photos that go into the "Property Vault."

### 6. Communication & Shopping
*   **Notices & Read Receipts:** Explain the difference between Memos and Landlord Notices. Point out the "read" indicators.
*   **Shopping List:** Highlight the "Urgent" flag for items that need immediate attention.

### 7. Navigation
*   **Floating Capsule Nav:** Explain that the bottom bar allows quick access to all these systems while they scroll behind the glass.

---

## 🤖 Claude Code Task Checklist
- [ ] Run the SQL migration above.
- [ ] Wrap the Dashboard in a `TutorialProvider`.
- [ ] Match tooltip styles to the "Porcelain Neon Glass" theme.
- [ ] Ensure the "Finish" button triggers the Supabase update.
```
