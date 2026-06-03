export type Segment =
  | 'Regular'
  | 'Explorer'
  | 'Flickerer'
  | 'Ghost'
  | 'Hoarder'
  | 'GroupBuyer'
  | 'Dormant'

export type PreferredTemp = 'ICED' | 'HOT' | 'BOTH'
export type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT'

export interface Customer {
  crm_id: string
  mobile: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  segment: Segment | null
  rfm_r: number | null
  rfm_f: number | null
  rfm_m: number | null
  total_visits: number
  last_visit_date: string | null
  first_visit_date: string | null
  avg_gap_days: number | null
  v1_to_v2_gap: number | null
  points_balance: number
  points_prev_balance: number
  voucher_redeemed: number
  outlet_count: number
  avg_item_quantity: number
  favourite_item: string | null
  favourite_outlet: string | null
  current_loc_code: string | null
  is_active: number
  last_updated: string
}

export interface DrinkProfile {
  customer_id: string
  favourite_drink: string | null
  preferred_temp: PreferredTemp | null
  preferred_time_slot: TimeSlot | null
  preferred_milk: string | null
  preferred_size: string | null
  top_modifier_1: string | null
  top_modifier_2: string | null
  last_updated: string
}

export interface Transaction {
  koppiku_ref: string
  zeoniq_ref: string | null
  razorpay_ref: string | null
  customer_id: string | null
  outlet_code: string | null
  transaction_date: string | null
  status: string | null
  total_amount: number
  net_sales: number
}

export interface BillItem {
  transaction_id: string
  bill_line_no: number | null
  item_name: string | null
  item_code: string | null
  order_start_time: string | null
  item_qty: number
  net_sales: number
  point_awarded: number
  point_redeemed: number
  is_modifier: boolean
  parent_item_code: string | null
  modifier_name: string | null
}

export interface JourneyLogEntry {
  customer_id: string
  action_date: string
  action_type: string
  channel: string
  message_template: string
  resolved_message: string
  completed: number
  outcome: string | null
}

export interface Csv1Row {
  'Date': string
  'Zeoniq Reference #': string
  'Koppiku Ref #': string
  'Razorpay #': string
  'Customer Name': string
  'Mobile #': string
  'Location': string
  'Status': string
  'Total Amount': string
  'Net Sales': string
}

export interface Csv2Row {
  'Bill Line No.': string
  'Business Date': string
  'Zeoniq Reference #': string
  'Koppiku Ref #': string
  'Outlet': string
  'Item': string
  'Code': string
  'Order Start Time': string
  'Item Qty': string
  'Net Sales': string
  'Point Awarded': string
  'Point Redeemed': string
  'Parent Item': string
  'Parent Code': string
  'Parent Bill Line No.': string
}

export interface Csv3Row {
  'id': string
  'crm_id': string
  'First Name': string
  'Middle Name': string
  'Last Name': string
  'Email': string
  'Mobile Number': string
  'Current Loc Code': string
  'Is Active': string
  'Cashback Rewards Points': string
  'Cashback Prev Rewards Points': string
  'Welcome Voucher': string
  'Created at': string
}

export interface UploadSummary {
  totalProcessed: number
  newCustomers: number
  segmentChanges: Array<{
    customerId: string
    name: string
    from: string | null
    to: string
  }>
  actionsGenerated: number
  errors: string[]
}

export interface RedemptionMenuItem {
  item_code: string
  item_name: string
  points_required: number
}
