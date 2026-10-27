# Dual Verification System - Implementation Plan

## Overview
Transform FaceSecure Pay to require face verification from BOTH sender AND recipient before completing payments.

## Current System
- Sender creates transaction → Sender verifies face → Payment completes immediately
- No recipient involvement in verification
- Face data stored as TEXT encoding (not photos)

## New System Requirements
1. **Two-Phase Verification:**
   - Phase 1: Sender verifies → Transaction enters "awaiting recipient" state
   - Phase 2: Recipient verifies → Payment completes

2. **Face Photo Storage:**
   - Store actual face photos (not just encodings)
   - One reference photo per user
   - Use photo for verification comparison

3. **Recipient Dashboard:**
   - Show pending incoming payments
   - Allow recipient to verify and accept

## Implementation Steps

### Phase 1: Database Schema Updates
1. Update `face_registrations` table to store photos
2. Add verification flags to `transactions` table
3. Create migration script

### Phase 2: Backend API Development
1. Face photo registration endpoint
2. Sender verification endpoint (marks sender_verified)
3. Recipient verification endpoint (completes payment)
4. Pending receipts endpoint

### Phase 3: Frontend Development
1. Face photo registration UI
2. Updated sender verification flow
3. Recipient verification interface
4. Pending receipts dashboard

### Phase 4: Testing
1. End-to-end flow testing
2. Edge case handling
3. Security validation

## Files to Modify
- `backend/config/schema.sql`
- `backend/routes/auth.js` (face registration)
- `backend/routes/transactions.js` (split verification)
- `frontend/register.html` or new `face-registration.html`
- `frontend/transactions.html`
- `frontend/js/face-verification.js`
- `frontend/js/dashboard.js`

## Status
- Planning: Complete
- Implementation: In Progress
