
-- FaceSecure Pay - Supabase Database Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/oosuhjvvyncmpoabmvru/editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE (Replaces users table)
-- =====================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT UNIQUE NOT NULL,
    payment_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    balance DECIMAL(10,2) DEFAULT 1000.00 CHECK (balance >= 0),
    face_registered BOOLEAN DEFAULT FALSE,
    account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_profiles_payment_number ON profiles(payment_number);
CREATE INDEX idx_profiles_phone ON profiles(phone);

-- =====================================================
-- 2. TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE NOT NULL,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    transaction_type TEXT DEFAULT 'personal' CHECK (transaction_type IN ('personal', 'business', 'bill')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    
    -- Dual Verification Fields
    sender_verified BOOLEAN DEFAULT FALSE,
    recipient_verified BOOLEAN DEFAULT FALSE,
    sender_verification_time TIMESTAMPTZ,
    recipient_verification_time TIMESTAMPTZ,
    verification_stage TEXT DEFAULT 'pending_sender' CHECK (verification_stage IN ('pending_sender', 'pending_recipient', 'both_verified')),
    
    -- Face Verification
    face_verified BOOLEAN DEFAULT FALSE,
    liveness_verified BOOLEAN DEFAULT FALSE,
    liveness_score DECIMAL(5,2),
    
    -- Fraud Detection
    fraud_score DECIMAL(5,2),
    fraud_check_result TEXT,
    fraud_check_passed BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    verification_attempts INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT different_users CHECK (sender_id != recipient_id)
);

-- Indexes for faster queries
CREATE INDEX idx_transactions_sender ON transactions(sender_id);
CREATE INDEX idx_transactions_recipient ON transactions(recipient_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- =====================================================
-- 3. FACE REGISTRATIONS TABLE
-- =====================================================
CREATE TABLE face_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    face_photo_url TEXT,  -- URL to Supabase Storage
    face_descriptor JSONB,  -- 128D face descriptor as JSON
    is_active BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active face per user (partial unique index)
CREATE UNIQUE INDEX idx_one_active_face_per_user ON face_registrations(user_id) WHERE is_active = TRUE;

-- Index for faster lookups
CREATE INDEX idx_face_registrations_user ON face_registrations(user_id) WHERE is_active = TRUE;

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_registrations ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Transactions Policies
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create transactions as sender"
    ON transactions FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders can update their transactions"
    ON transactions FOR UPDATE
    USING (auth.uid() = sender_id)
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update received transactions"
    ON transactions FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- Face Registrations Policies
CREATE POLICY "Users can view own face registration"
    ON face_registrations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own face registration"
    ON face_registrations FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- 5. FUNCTIONS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Trigger for transactions
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 6. COMPLETE TRANSACTION FUNCTION (Atomic Balance Transfer)
-- =====================================================
CREATE OR REPLACE FUNCTION complete_transaction(
    p_transaction_id TEXT,
    p_recipient_id UUID,
    p_liveness_score DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction transactions%ROWTYPE;
    v_sender_balance DECIMAL;
    v_recipient_balance DECIMAL;
    v_result JSON;
BEGIN
    -- Lock transaction row for update
    SELECT * INTO v_transaction
    FROM transactions
    WHERE transaction_id = p_transaction_id
    AND recipient_id = p_recipient_id
    AND status = 'pending'
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found or not pending';
    END IF;
    
    -- Check sender has verified
    IF NOT v_transaction.sender_verified THEN
        RAISE EXCEPTION 'Sender must verify first';
    END IF;
    
    -- Check recipient hasn't already verified
    IF v_transaction.recipient_verified THEN
        RAISE EXCEPTION 'Transaction already completed';
    END IF;
    
    -- Get current balances
    SELECT balance INTO v_sender_balance
    FROM profiles
    WHERE id = v_transaction.sender_id
    FOR UPDATE;
    
    SELECT balance INTO v_recipient_balance
    FROM profiles
    WHERE id = v_transaction.recipient_id
    FOR UPDATE;
    
    -- Check sender has sufficient balance
    IF v_sender_balance < v_transaction.amount THEN
        -- Mark transaction as failed
        UPDATE transactions
        SET status = 'failed',
            updated_at = NOW()
        WHERE id = v_transaction.id;
        
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- Transfer money atomically
    UPDATE profiles
    SET balance = balance - v_transaction.amount,
        updated_at = NOW()
    WHERE id = v_transaction.sender_id;
    
    UPDATE profiles
    SET balance = balance + v_transaction.amount,
        updated_at = NOW()
    WHERE id = v_transaction.recipient_id;
    
    -- Mark transaction as completed
    UPDATE transactions
    SET status = 'completed',
        recipient_verified = TRUE,
        recipient_verification_time = NOW(),
        verification_stage = 'both_verified',
        face_verified = TRUE,
        liveness_verified = TRUE,
        liveness_score = p_liveness_score,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_transaction.id;
    
    -- Return transaction with updated balances
    SELECT json_build_object(
        'success', TRUE,
        'transaction', row_to_json(t.*),
        'sender_balance', v_sender_balance - v_transaction.amount,
        'recipient_balance', v_recipient_balance + v_transaction.amount
    ) INTO v_result
    FROM transactions t
    WHERE t.id = v_transaction.id;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback happens automatically
        RAISE;
END;
$$;

-- =====================================================
-- 7. VERIFY SENDER FUNCTION (Phase 1)
-- =====================================================
CREATE OR REPLACE FUNCTION verify_sender(
    p_transaction_id TEXT,
    p_sender_id UUID,
    p_liveness_score DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction transactions%ROWTYPE;
    v_recipient profiles%ROWTYPE;
    v_result JSON;
BEGIN
    -- Lock transaction
    SELECT * INTO v_transaction
    FROM transactions
    WHERE transaction_id = p_transaction_id
    AND sender_id = p_sender_id
    AND status = 'pending'
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found or you are not the sender';
    END IF;
    
    -- Check if already verified
    IF v_transaction.sender_verified THEN
        RAISE EXCEPTION 'Sender already verified';
    END IF;
    
    -- Update transaction
    UPDATE transactions
    SET sender_verified = TRUE,
        sender_verification_time = NOW(),
        verification_stage = 'pending_recipient',
        liveness_score = p_liveness_score,
        updated_at = NOW()
    WHERE id = v_transaction.id;
    
    -- Get recipient info
    SELECT * INTO v_recipient
    FROM profiles
    WHERE id = v_transaction.recipient_id;
    
    -- Build result
    SELECT json_build_object(
        'success', TRUE,
        'message', 'Sender verified successfully',
        'transaction', row_to_json(t.*),
        'recipient', json_build_object(
            'name', v_recipient.full_name,
            'payment_number', v_recipient.payment_number
        )
    ) INTO v_result
    FROM transactions t
    WHERE t.id = v_transaction.id;
    
    RETURN v_result;
END;
$$;

-- =====================================================
-- 8. GET PENDING RECEIPTS FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_receipts(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'success', TRUE,
        'transactions', COALESCE(json_agg(
            json_build_object(
                'transaction_id', t.transaction_id,
                'amount', t.amount,
                'sender_name', p.full_name,
                'sender_payment_number', p.payment_number,
                'created_at', t.created_at,
                'description', t.description
            ) ORDER BY t.created_at DESC
        ), '[]'::json),
        'count', COUNT(*)::INTEGER,
        'total_amount', COALESCE(SUM(t.amount), 0)
    ) INTO v_result
    FROM transactions t
    JOIN profiles p ON t.sender_id = p.id
    WHERE t.recipient_id = p_user_id
    AND t.status = 'pending'
    AND t.sender_verified = TRUE
    AND t.recipient_verified = FALSE;
    
    RETURN v_result;
END;
$$;

-- =====================================================
-- 9. STORAGE BUCKET FOR FACE PHOTOS
-- =====================================================
-- Run this in the Supabase Storage section manually:
-- 1. Create bucket: 'face-photos'
-- 2. Make it private
-- 3. Set policies:

-- Policy to allow users to upload their own face photos
-- INSERT INTO storage.objects (bucket_id, name, owner, metadata)
-- VALUES ('face-photos', 'users/{user_id}/face.jpg', auth.uid(), '{}'::jsonb);

-- =====================================================
-- DONE! 🎉
-- =====================================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Create 'face-photos' bucket in Storage
-- 3. Set up Twilio for SMS OTP in Authentication
-- 4. Update frontend to use Supabase client

