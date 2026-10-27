-- Migration: Add Dual Verification Support
-- This migration enables both sender and recipient face verification

-- Step 1: Update face_registrations table to store actual photos
ALTER TABLE face_registrations 
ADD COLUMN face_photo LONGBLOB COMMENT 'Reference face photo for verification' AFTER face_encoding,
ADD COLUMN photo_format VARCHAR(10) DEFAULT 'jpeg' COMMENT 'Image format (jpeg, png)',
ADD COLUMN photo_size INT COMMENT 'Photo size in bytes',
ADD COLUMN photo_uploaded_at TIMESTAMP NULL COMMENT 'When photo was uploaded';

-- Step 2: Add verification flags to transactions table
ALTER TABLE transactions
ADD COLUMN sender_verified BOOLEAN DEFAULT FALSE COMMENT 'Sender completed face verification',
ADD COLUMN sender_verification_time TIMESTAMP NULL COMMENT 'When sender verified',
ADD COLUMN recipient_verified BOOLEAN DEFAULT FALSE COMMENT 'Recipient completed face verification', 
ADD COLUMN recipient_verification_time TIMESTAMP NULL COMMENT 'When recipient verified',
ADD COLUMN verification_stage ENUM('pending_sender', 'pending_recipient', 'both_verified') DEFAULT 'pending_sender' COMMENT 'Current verification stage';

-- Step 3: Add index for pending recipient verifications
CREATE INDEX idx_recipient_pending ON transactions(recipient_id, recipient_verified, status);

-- Step 4: Update existing transactions to match new schema
-- Mark all completed transactions as verified by both parties
UPDATE transactions 
SET sender_verified = TRUE,
    recipient_verified = TRUE,
    verification_stage = 'both_verified',
    sender_verification_time = completed_at,
    recipient_verification_time = completed_at
WHERE status = 'completed';

-- Mark pending transactions as needing sender verification
UPDATE transactions
SET sender_verified = FALSE,
    recipient_verified = FALSE,
    verification_stage = 'pending_sender'
WHERE status = 'pending';
