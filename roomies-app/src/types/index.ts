export type PresenceStatus = 'Available' | 'Sleeping' | 'Quiet Hours / Studying' | 'Work From Home' | 'Away'
export type MemberRole = 'Administrator' | 'Tenant' | 'Landlord'
export type ChoreRecurrence = 'Twice Weekly' | 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Quarterly'
export type ChoreStatus = 'Pending' | 'Completed' | 'Swapped' | 'Auctioned'
export type ExpenseCategory = 'Rent' | 'Groceries' | 'Utilities' | 'Shared Subscriptions' | 'Miscellaneous Ad-Hoc'
export type NoticeType = 'Instant Buzz Notification' | 'Permanent Memo' | 'Formal Landlord Notice'
export type MaintenanceStatus = 'Open' | 'Vendor Dispatched' | 'Resolved'
export type PetAction = 'Morning Feed' | 'Evening Feed' | 'Daily Walk' | 'Medication Administered'

export interface Household {
  id: string
  title: string
  invite_code: string
  created_at: string
}

export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  karma: number
  household_id: string | null
  away: boolean
  updated_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  profile_id: string
  role: MemberRole
  joined_at: string
  profiles?: Profile
}

export interface UserPresence {
  profile_id: string
  status: PresenceStatus
  custom_text: string | null
  updated_at: string
  profiles?: Profile
}

export interface Chore {
  id: string
  household_id: string
  title: string
  description: string | null
  recurrence: ChoreRecurrence
  rotation_offset: number
  created_at: string
}

export interface ChoreAssignment {
  id: string
  chore_id: string
  assigned_to: string
  due_date: string
  status: ChoreStatus
  completed_at: string | null
  chores?: Chore
  profiles?: Profile
}

export interface KarmaMarketplace {
  id: string
  assignment_id: string
  cash_bounty: number
  karma_bounty: number
  is_open: boolean
  created_at: string
  chore_assignments?: ChoreAssignment
}

export interface Transaction {
  id: string
  household_id: string
  paid_by: string
  amount: number
  memo: string
  category: ExpenseCategory
  created_at: string
  profiles?: Profile
  transaction_splits?: TransactionSplit[]
}

export interface TransactionSplit {
  id: string
  transaction_id: string
  debtor_id: string
  amount_owed: number
  settled: boolean
  profiles?: Profile
}

export interface Subscription {
  id: string
  household_id: string
  title: string
  monthly_cost: number
  owner_id: string
  started_at: string
  profiles?: Profile
  subscription_members?: SubscriptionMember[]
}

export interface SubscriptionMember {
  id: string
  subscription_id: string
  profile_id: string
  profiles?: Profile
}

export interface ShoppingItem {
  id: string
  household_id: string
  added_by: string
  title: string
  quantity: string
  urgent: boolean
  purchased: boolean
  created_at: string
  profiles?: Profile
}

export interface Notice {
  id: string
  household_id: string
  author_id: string
  title: string | null
  body: string
  type: NoticeType
  created_at: string
  profiles?: Profile
  read_acks?: ReadAck[]
}

export interface ReadAck {
  id: string
  notice_id: string
  user_id: string
  read_at: string
}

export interface Booking {
  id: string
  household_id: string
  booked_by: string
  resource_name: string
  start_time: string
  end_time: string
  profiles?: Profile
}

export interface GuestLog {
  id: string
  household_id: string
  host_id: string
  guest_name: string
  arrival_date: string
  departure_date: string
  profiles?: Profile
}

export interface MaintenanceTicket {
  id: string
  household_id: string
  reported_by: string
  title: string
  description: string
  image_url: string | null
  status: MaintenanceStatus
  created_at: string
  profiles?: Profile
}

export interface PetLog {
  id: string
  household_id: string
  pet_name: string
  action: PetAction
  done_by: string
  action_at: string
  profiles?: Profile
}

export interface CoLivingAgreement {
  household_id: string
  quiet_start: string
  quiet_end: string
  hygiene_score: number
  guest_overstay_rules: string
  updated_at: string
}

export interface AgreementSignature {
  id: string
  household_id: string
  user_id: string
  signed_at: string
}

export interface LockboxSecret {
  id: string
  household_id: string
  key_name: string
  value: string
  is_restricted: boolean
}

export interface NetBalance {
  profileId: string
  username: string
  net: number
}

export interface Transfer {
  from: string
  to: string
  amount: number
}
