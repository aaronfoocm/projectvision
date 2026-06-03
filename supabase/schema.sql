-- Run this in the Supabase SQL editor at:
-- https://supabase.com/dashboard/project/vpvolbqgnwgwflikdryd/sql/new

CREATE TABLE IF NOT EXISTS customers (
  crm_id TEXT PRIMARY KEY,
  mobile TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  segment TEXT,
  rfm_r INTEGER,
  rfm_f INTEGER,
  rfm_m INTEGER,
  total_visits INTEGER NOT NULL DEFAULT 0,
  last_visit_date TEXT,
  first_visit_date TEXT,
  avg_gap_days REAL,
  v1_to_v2_gap INTEGER,
  points_balance REAL NOT NULL DEFAULT 0,
  points_prev_balance REAL NOT NULL DEFAULT 0,
  voucher_redeemed INTEGER NOT NULL DEFAULT 0,
  outlet_count INTEGER NOT NULL DEFAULT 0,
  avg_item_quantity REAL NOT NULL DEFAULT 0,
  favourite_item TEXT,
  favourite_outlet TEXT,
  current_loc_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS drink_profiles (
  customer_id TEXT PRIMARY KEY REFERENCES customers(crm_id),
  favourite_drink TEXT,
  preferred_temp TEXT,
  preferred_time_slot TEXT,
  preferred_milk TEXT,
  preferred_size TEXT,
  top_modifier_1 TEXT,
  top_modifier_2 TEXT,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  koppiku_ref TEXT PRIMARY KEY,
  zeoniq_ref TEXT,
  razorpay_ref TEXT,
  customer_id TEXT REFERENCES customers(crm_id),
  outlet_code TEXT,
  transaction_date TIMESTAMPTZ,
  status TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  net_sales REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bill_items (
  id BIGSERIAL PRIMARY KEY,
  transaction_id TEXT REFERENCES transactions(koppiku_ref),
  bill_line_no INTEGER,
  item_name TEXT,
  item_code TEXT,
  order_start_time TEXT,
  item_qty INTEGER NOT NULL DEFAULT 0,
  net_sales REAL NOT NULL DEFAULT 0,
  point_awarded REAL NOT NULL DEFAULT 0,
  point_redeemed REAL NOT NULL DEFAULT 0,
  is_modifier BOOLEAN NOT NULL DEFAULT false,
  parent_item_code TEXT,
  modifier_name TEXT
);

CREATE TABLE IF NOT EXISTS journey_log (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT REFERENCES customers(crm_id),
  action_date TEXT,
  action_type TEXT,
  channel TEXT,
  message_template TEXT,
  resolved_message TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  outcome TEXT
);

CREATE TABLE IF NOT EXISTS segment_history (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT REFERENCES customers(crm_id),
  old_segment TEXT,
  new_segment TEXT,
  changed_date TEXT
);

CREATE TABLE IF NOT EXISTS upload_log (
  id BIGSERIAL PRIMARY KEY,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  file_type TEXT,
  row_count INTEGER,
  status TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS redemption_menu (
  item_code TEXT PRIMARY KEY,
  item_name TEXT,
  points_required INTEGER NOT NULL DEFAULT 0
);
