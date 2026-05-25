CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_account_status_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_account_status_check
    CHECK (account_status IN ('active', 'deactivated', 'closed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_number TEXT UNIQUE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EGP',
  account_type TEXT NOT NULL DEFAULT 'checking',
  account_status TEXT NOT NULL DEFAULT 'active',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  can_send_transfers BOOLEAN NOT NULL DEFAULT TRUE,
  can_receive_transfers BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'checking';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS can_send_transfers BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS can_receive_transfers BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_user_id_key'
  ) THEN
    ALTER TABLE accounts DROP CONSTRAINT accounts_user_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_account_status_check'
  ) THEN
    ALTER TABLE accounts
    ADD CONSTRAINT accounts_account_status_check
    CHECK (account_status IN ('active', 'deactivated', 'closed'));
  END IF;
END $$;

WITH ranked_accounts AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
  FROM accounts
)
UPDATE accounts a
SET is_primary = (ranked_accounts.rn = 1)
FROM ranked_accounts
WHERE a.id = ranked_accounts.id;

CREATE TABLE IF NOT EXISTS mfa_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  requested_term_months INTEGER NOT NULL,
  approved_term_months INTEGER,
  requested_interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  approved_interest_rate NUMERIC(5,2),
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loans_status_check'
  ) THEN
    ALTER TABLE loans
    ADD CONSTRAINT loans_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed', 'repaid'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loans_requested_term_check'
  ) THEN
    ALTER TABLE loans
    ADD CONSTRAINT loans_requested_term_check
    CHECK (requested_term_months BETWEEN 6 AND 60);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loans_approved_term_check'
  ) THEN
    ALTER TABLE loans
    ADD CONSTRAINT loans_approved_term_check
    CHECK (approved_term_months IS NULL OR approved_term_months BETWEEN 6 AND 60);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loans_requested_interest_check'
  ) THEN
    ALTER TABLE loans
    ADD CONSTRAINT loans_requested_interest_check
    CHECK (requested_interest_rate BETWEEN 0 AND 36);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loans_approved_interest_check'
  ) THEN
    ALTER TABLE loans
    ADD CONSTRAINT loans_approved_interest_check
    CHECK (approved_interest_rate IS NULL OR approved_interest_rate BETWEEN 0 AND 36);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'due',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, installment_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loan_repayments_status_check'
  ) THEN
    ALTER TABLE loan_repayments
    ADD CONSTRAINT loan_repayments_status_check
    CHECK (status IN ('due', 'paid', 'overdue'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS loan_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  reason TEXT,
  approved_term_months INTEGER,
  approved_interest_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loan_decisions_decision_check'
  ) THEN
    ALTER TABLE loan_decisions
    ADD CONSTRAINT loan_decisions_decision_check
    CHECK (decision IN ('approved', 'rejected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  note_ciphertext BYTEA,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_account_id <> to_account_id)
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note_ciphertext BYTEA;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  account_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, account_number)
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_tickets_status_check'
  ) THEN
    ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_status_check
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  card_type TEXT NOT NULL DEFAULT 'debit',
  card_last4 CHAR(4) NOT NULL,
  external_provider TEXT NOT NULL DEFAULT 'sandbox',
  provider_ref TEXT,
  provider_status TEXT NOT NULL DEFAULT 'pending',
  provider_error_code TEXT,
  provider_error_message TEXT,
  provider_last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  is_reported_lost BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cards ADD COLUMN IF NOT EXISTS external_provider TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS provider_ref TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS provider_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS provider_error_code TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS provider_error_message TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS provider_last_synced_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cards_status_check'
  ) THEN
    ALTER TABLE cards DROP CONSTRAINT cards_status_check;
  END IF;

  ALTER TABLE cards
  ADD CONSTRAINT cards_status_check
  CHECK (status IN ('pending', 'active', 'frozen', 'lost', 'disabled'));
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cards_provider_status_check'
  ) THEN
    ALTER TABLE cards
    ADD CONSTRAINT cards_provider_status_check
    CHECK (provider_status IN ('pending', 'succeeded', 'failed', 'blocked', 'lost'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  account_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  transfer_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  payment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  support_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  security_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  system_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TABLE IF EXISTS recurring_payments CASCADE;
DROP TABLE IF EXISTS bill_payments CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_outbox_channel_check'
  ) THEN
    ALTER TABLE notification_outbox
    ADD CONSTRAINT notification_outbox_channel_check
    CHECK (channel IN ('email'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_outbox_status_check'
  ) THEN
    ALTER TABLE notification_outbox
    ADD CONSTRAINT notification_outbox_status_check
    CHECK (status IN ('pending', 'sent', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('account', 'transfer', 'payment', 'support', 'security', 'system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_primary ON accounts(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_accounts_number ON accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_transactions_from_created ON transactions(from_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_to_created ON transactions(to_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_user ON beneficiaries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_cards_provider_ref ON cards(external_provider, provider_ref);
CREATE INDEX IF NOT EXISTS idx_loans_user_status ON loans(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_status_created ON loans(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_target_account ON loans(target_account_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON loan_repayments(loan_id, installment_number);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_due_date ON loan_repayments(due_date);
CREATE INDEX IF NOT EXISTS idx_loan_decisions_loan ON loan_decisions(loan_id, created_at DESC);
