# Implementation Plan: Primary Payment Number System

## Overview
Transform FaceSecure Pay to use a primary payment number for transactions (PhonePe/Google Pay style). Users will send money using 10-digit payment numbers instead of username/email/phone search. Phone number becomes optional during registration.

## Project Context
- **Frontend**: Vanilla HTML/CSS/JS in `frontend/` folder
- **Backend**: Node.js/Express in `backend/` folder
- **Database**: MySQL database named "nada"
- **Build**: No build step required (vanilla JS); backend uses `npm start` or `npm run dev`
- **Test**: Manual testing via `node test-api.js` and browser testing
- **Current Users**: Alice (@alice123), Bob (@bob456), nakri123

---

## Implementation Steps

- [ ] 1. **Add payment_number column to users table and generate numbers for existing users**
      
      Modify the database schema to add a `payment_number` column (VARCHAR(10), UNIQUE, NOT NULL, indexed). Write and run a migration script that:
      - Adds the payment_number column
      - Generates unique 10-digit payment numbers for the 3 existing users (Alice, Bob, nakri123)
      - Ensures no collisions with a uniqueness check
      
      **Files**: 
      - Create `backend/migrate-add-payment-number.js` (new migration script)
      - Update `backend/config/schema.sql` (add payment_number column definition for future fresh installs)
      
      **Verify**: Run `node backend/migrate-add-payment-number.js` and confirm it completes successfully. Then run `mysql -u root -p nada -e "SELECT id, username, payment_number FROM users;"` to verify all 3 existing users now have unique 10-digit payment numbers.

---

- [ ] 2. **Update backend registration endpoint to auto-generate payment numbers and make phone optional**
      
      Modify `backend/routes/auth.js` POST `/register` endpoint to:
      - Generate a unique random 10-digit payment number for each new user
      - Include collision detection (retry generation if duplicate)
      - Make the `phone` field validation fully optional (remove any required checks)
      - Return the payment_number in the registration response
      
      **Files**: 
      - `backend/routes/auth.js` (modify registration logic)
      
      **Verify**: Run `node backend/test-api.js` to test user registration. Confirm the response includes a `payment_number` field with a 10-digit number, and that registration succeeds without providing a phone number.

---

- [ ] 3. **Update backend GET /api/auth/profile endpoint to return payment_number**
      
      Modify the profile endpoint to include payment_number in the user object returned.
      
      **Files**: 
      - `backend/routes/auth.js` (modify profile query and response)
      
      **Verify**: Test with `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/auth/profile` and confirm the response includes the `payment_number` field.

---

- [ ] 4. **Add new GET /api/auth/payment-number endpoint for payment number lookups**
      
      Create a new authenticated endpoint `GET /api/auth/payment-number?number=1234567890` that:
      - Accepts a 10-digit payment number as query parameter
      - Returns the user's public info (id, username, full_name) if found
      - Returns 404 if not found
      - Does NOT return the current user (can't send to yourself)
      - Validates that the input is exactly 10 digits
      
      **Files**: 
      - `backend/routes/auth.js` (add new endpoint)
      
      **Verify**: Test with `curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/auth/payment-number?number=<valid_payment_number>"` and confirm it returns the correct user info.

---

- [ ] 5. **Update backend POST /api/transactions/send to accept payment_number as recipient identifier**
      
      Modify the send endpoint to:
      - Accept `recipientIdentifier` that can be a 10-digit payment number
      - Detect if the identifier is numeric and exactly 10 digits → treat as payment number
      - Search for recipient by payment_number first if it matches the pattern
      - Fall back to existing username/email/phone/ID search if not a 10-digit number
      - Ensure backward compatibility with existing transaction flows
      
      **Files**: 
      - `backend/routes/transactions.js` (modify recipient search logic in POST /send)
      
      **Verify**: Run `node backend/test-transactions.js` (or create a test script) to verify transactions can be initiated using a payment number. Confirm existing username/email lookups still work.

---

- [ ] 6. **Update frontend registration form to remove phone requirement and display generated payment number**
      
      Modify `frontend/register.html` and inline script to:
      - Change phone input label to "Phone Number (Optional)" (already done in current code)
      - Remove any required validation on phone field in inline script
      - After successful registration, display the generated payment_number prominently (e.g., in success message or redirect with it)
      - Update `frontend/js/auth.js` register() function to handle and store payment_number from response
      
      **Files**: 
      - `frontend/register.html` (update validation and success handling)
      - `frontend/js/auth.js` (store payment_number in user object)
      
      **Verify**: Open `frontend/register.html` in browser, register a new user without phone number, and confirm registration succeeds and displays/stores the payment number.

---

- [ ] 7. **Update frontend dashboard to display payment number prominently**
      
      Modify the transaction page dashboard to show the user's payment number in a prominent location:
      - Add payment number display in the sidebar user profile section
      - Show as "Payment Number: 1234567890" with copy-to-clipboard functionality
      - Style it distinctly (e.g., monospace font, badge style)
      
      **Files**: 
      - `frontend/transactions.html` (add payment number display to sidebar)
      - `frontend/js/transactions.js` (populate payment number from user profile)
      - `frontend/styles/transactions.css` (add styling for payment number display)
      
      **Verify**: Login to the app, navigate to transactions page, and confirm the payment number is visible in the sidebar with proper styling.

---

- [ ] 8. **Update frontend transaction form to use payment number input**
      
      Modify `frontend/transactions.html` and `frontend/js/transactions.js` to:
      - Change recipient input label to "Recipient Payment Number"
      - Change placeholder to "Enter 10-digit payment number"
      - Add input validation to only accept exactly 10 numeric digits
      - Update searchRecipient() function to call the new payment-number lookup endpoint
      - Show recipient name confirmation after valid payment number is entered
      - Remove or comment out old username/email/phone search UI elements (keep backend support for backward compatibility)
      
      **Files**: 
      - `frontend/transactions.html` (update form UI)
      - `frontend/js/transactions.js` (modify recipient search to use payment numbers)
      - `frontend/styles/transactions.css` (update styling if needed)
      
      **Verify**: Open transactions page, enter a valid 10-digit payment number, and confirm recipient is found and displayed. Try entering invalid formats (9 digits, letters) and confirm validation errors appear.

---

- [ ] 9. **Update admin dashboard to display payment numbers in user listings**
      
      The admin dashboard needs to show payment numbers when viewing users. Since there's no explicit user list view in the current admin.js, we need to add payment_number to any user data displays. Check if admin routes need to be updated to include payment_number in responses.
      
      **Files**: 
      - `backend/routes/admin.js` (ensure any user queries include payment_number)
      - `frontend/js/admin.js` (display payment_number in any user-related data tables/cards)
      - `frontend/admin.html` (update UI if users are displayed)
      
      **Verify**: Login as admin, view any user listings or details, and confirm payment numbers are displayed alongside usernames.

---

- [ ] 10. **Update API config to include payment-number endpoint**
      
      Add the new payment-number lookup endpoint to the API configuration constants.
      
      **Files**: 
      - `frontend/js/config.js` (add GET_PAYMENT_NUMBER_USER endpoint)
      
      **Verify**: Check that the endpoint constant is defined and matches the backend route pattern.

---

- [ ] 11. **End-to-end integration test**
      
      Perform a complete workflow test:
      - Register a new user (without phone number) and note the payment number
      - Login as an existing user (Alice or Bob)
      - View their payment number in the dashboard
      - Initiate a transaction using the new user's payment number
      - Complete fraud check and face verification
      - Confirm transaction completes and balances update
      - Verify transaction history shows the transaction
      - Test that entering invalid payment numbers shows proper errors
      
      **Files**: 
      - No file changes, testing only
      
      **Verify**: All the above steps complete successfully with payment numbers. Document any issues found and confirm fixes work.

---

## Design Decisions

1. **Payment Number Format**: 10-digit numeric format chosen to match PhonePe/Google Pay patterns. Easy to read, type, and validate. Stored as VARCHAR(10) for flexibility with leading zeros.

2. **Generation Strategy**: Random 10-digit numbers (1000000000 to 9999999999) with collision detection. Random distribution reduces predictability. Auto-retry on duplicate ensures reliability.

3. **Migration Strategy**: For existing 3 users, a one-time migration script generates payment numbers. New users get numbers during registration. This avoids NULL values and ensures UNIQUE constraint can be enforced.

4. **Backward Compatibility**: Backend still accepts username/email/phone/ID searches for recipient lookup, but frontend only exposes payment number input. This allows API flexibility while guiding users to the new payment number system.

5. **Phone Optional**: Since payment number is now the primary identifier, phone becomes truly optional. Users can complete registration and transact without ever providing a phone number.

6. **Frontend Validation**: Client-side validation ensures only 10-digit numeric input, with real-time feedback. Server-side validation confirms payment number exists and is valid.

7. **Display Prominence**: Payment number shown in sidebar with copy-to-clipboard functionality (to be implemented as enhancement). Monospace font and badge styling make it easily identifiable.

8. **Admin Dashboard**: Payment numbers added to admin views for better user identification and support. Admins can reference users by payment number.

---

## Verification Summary

After completing all steps:
- Run `npm start` in `backend/` directory to start the server
- Open `frontend/index.html` via Live Server (port 5500)
- Register a new user without phone → confirm payment number generated and displayed
- Login as existing user → confirm payment number visible in dashboard
- Send money using payment number → confirm transaction completes
- Check admin dashboard → confirm payment numbers displayed
- Verify all 3 existing users have payment numbers in database

---

## Notes

- No build step required for frontend (vanilla JS)
- Backend uses nodemon for development: `npm run dev`
- Database schema.sql updated for future fresh installs
- Existing fraud detection and face verification systems remain unchanged
- Transaction flow (fraud check → face verify → complete) remains the same
- Only the recipient identification method changes from search to payment number
