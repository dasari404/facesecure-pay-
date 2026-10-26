-- Migration: Add missing verification columns to transactions table
-- Date: 2024
-- Purpose: Fix HTTP 500 error in POST /api/transactions/verify

USE nada;

-- Add liveness_score column to store the actual liveness score from verification
ALTER TABLE transactions 
ADD COLUMN liveness_score DECIMAL(5, 2) DEFAULT NULL 
COMMENT 'Liveness score from face verification (0-100)';

-- Add verification_attempts column to track failed verification attempts
ALTER TABLE transactions 
ADD COLUMN verification_attempts INT DEFAULT 0 
COMMENT 'Number of verification attempts made';

-- Verify the changes
DESCRIBE transactions;
