# Supabase Setup Instructions for FaceSecure Pay

## ✅ Step 1: Run Database Schema

1. Go to your Supabase SQL Editor:
   https://supabase.com/dashboard/project/oosuhjvvyncmpoabmvru/editor

2. Copy the entire contents of `supabase-setup.sql`

3. Paste and click **Run**

4. You should see: "Success. No rows returned"

This creates all tables, functions, and security policies.

---

## ✅ Step 2: Create Storage Bucket for Face Photos

1. Go to Storage:
   https://supabase.com/dashboard/project/oosuhjvvyncmpoabmvru/storage/buckets

2. Click **New Bucket**

3. **Bucket name:** `face-photos`

4. **Public:** No (keep private)

5. Click **Create bucket**

6. Click on `face-photos` bucket → **Policies** tab

7. Add policy for INSERT:
   ```sql
   CREATE POLICY "Users can upload own face"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'face-photos' 
     AND auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

8. Add policy for SELECT:
   ```sql
   CREATE POLICY "Users can view own face"
   ON storage.objects FOR SELECT
   USING (
     bucket_id = 'face-photos'
     AND auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

---

## ✅ Step 3: Set Up SMS OTP (Twilio)

### 3A. Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up (free trial gets ₹1300 credit)
3. Verify your phone number
4. Complete the "Get Started" wizard

### 3B. Get Twilio Credentials

1. Go to Twilio Console: https://console.twilio.com
2. Copy these:
   - **Account SID** (starts with AC...)
   - **Auth Token** (click "View" to see it)
3. Go to Phone Numbers → Buy a Number
   - Choose India (+91)
   - Select a number with SMS capability
   - Buy it (uses free credit)
4. Copy your **Twilio Phone Number**

### 3C. Configure Supabase with Twilio

1. Go to Supabase Authentication:
   https://supabase.com/dashboard/project/oosuhjvvyncmpoabmvru/auth/providers

2. Scroll to **Phone** → Click **Enable**

3. Select **Twilio** as SMS provider

4. Enter your Twilio credentials:
   - **Twilio Account SID**: AC...
   - **Twilio Auth Token**: (your token)
   - **Twilio Message Service SID**: Leave blank for now
   - **Twilio Phone Number**: +1234567890 (your Twilio number)

5. Click **Save**

### 3D. Configure OTP Settings

1. In the same Authentication page
2. **OTP expiration:** 60 seconds (default)
3. **OTP length:** 6 digits (default)
4. **Rate limits:**
   - 3 OTPs per hour per phone
   - 60 seconds between resends

5. **Test it:**
   - Try sending OTP to your phone
   - You should receive an SMS with 6-digit code

---

## ✅ Step 4: Get Your API Keys

1. Go to Settings → API:
   https://supabase.com/dashboard/project/oosuhjvvyncmpoabmvru/settings/api

2. Copy these keys:

   **Project URL:**
   ```
   https://oosuhjvvyncmpoabmvru.supabase.co
   ```

   **Anon (public) key:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...
   ```

   ⚠️ **Keep this safe** - it's public but limited by RLS policies

   **Service role key:** (DO NOT SHARE!)
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...
   ```

   ⚠️ **NEVER commit this to Git** - it has admin access

---

## ✅ Step 5: Update Frontend Configuration

1. Open `frontend/js/supabase-config.js`

2. Replace `YOUR_ANON_KEY_HERE` with your **Anon key**:
   ```javascript
   const SUPABASE_CONFIG = {
       url: 'https://oosuhjvvyncmpoabmvru.supabase.co',
       anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // ← Paste here
   };
   ```

3. Save the file

---

## ✅ Step 6: Update HTML Files to Use Supabase

### Update index.html, login.html, register.html

Add these scripts **BEFORE** other JS files:

```html
<!-- Supabase Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Supabase Configuration -->
<script src="js/supabase-config.js"></script>
<script src="js/supabase-auth.js"></script>
```

**Full order should be:**
```html
<!-- 1. Supabase -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-config.js"></script>
<script src="js/supabase-auth.js"></script>

<!-- 2. Face API -->
<script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js"></script>

<!-- 3. App files -->
<script src="js/config.js"></script>
<script src="js/utils.js"></script>
<script src="js/auth.js"></script>
<script src="js/transactions.js"></script>
<script src="js/face-verification.js"></script>
<script src="js/app.js"></script>
```

---

## ✅ Step 7: Test Everything

### Test 1: Registration with OTP

1. Open `register.html` in browser
2. Enter phone: **+919876543210** (your real number)
3. Fill other details
4. Click **Register**
5. You should receive SMS with 6-digit code
6. Enter code in OTP modal
7. Should create account and redirect to dashboard

### Test 2: Login with OTP

1. Open `login.html`
2. Enter same phone number
3. Click **Login**
4. Receive OTP via SMS
5. Enter code
6. Should login successfully

### Test 3: Database Check

1. Go to Supabase Table Editor:
   https://supabase.com/dashboard/project/oosuhjvvyncmpoabmvru/editor

2. Click on `profiles` table

3. You should see your user with:
   - UUID as primary key
   - Phone number
   - Payment number (10 digits)
   - Balance: ₹1000.00

---

## 🎉 Success Checklist

- ✅ Database schema created (tables, functions, policies)
- ✅ Storage bucket created (`face-photos`)
- ✅ Twilio account created and configured
- ✅ SMS OTP working (received test SMS)
- ✅ API keys copied and saved
- ✅ Frontend config updated with keys
- ✅ HTML files updated with Supabase scripts
- ✅ Registration working with OTP
- ✅ Login working with OTP
- ✅ User profile created in database

---

## 📱 Test Phone Numbers (Twilio Free Trial)

Twilio free trial only allows SMS to **verified numbers**:

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
2. Click **Add a new number**
3. Enter phone number
4. Verify with code sent to that number
5. Now you can send OTP to this number

---

## 💰 Costs

**Supabase Free Tier:**
- 500 MB database
- 1 GB storage
- 2 GB bandwidth
- 50,000 monthly active users
- Unlimited API requests

**Twilio:**
- Free trial: ₹1300 credit
- After trial: ₹0.75 per SMS (India)
- Buy more credit as needed

---

## 🔐 Security Notes

1. **Never share Service Role Key**
2. **Add .env to .gitignore**
3. **Keep Twilio Auth Token secret**
4. **Enable Row Level Security (RLS)** - Already done in SQL script
5. **Use HTTPS in production**

---

## 🚀 Next Steps

After everything works:

1. **Migrate face verification to backend** (Edge Functions)
2. **Add face photo upload to Storage**
3. **Implement transaction flow with Supabase**
4. **Deploy to production**
5. **Set up monitoring**

---

## 📚 Documentation Links

- Supabase Docs: https://supabase.com/docs
- Supabase Auth: https://supabase.com/docs/guides/auth
- Twilio SMS: https://www.twilio.com/docs/sms
- Face-API.js: https://justadudewhohacks.github.io/face-api.js/docs/

---

## ❓ Troubleshooting

**OTP not received?**
- Check Twilio phone number is SMS-capable
- Verify recipient number in Twilio console
- Check Twilio logs for delivery status

**"Invalid credentials" error?**
- Verify Anon Key is correct
- Check Project URL matches
- Ensure keys are not expired

**"Row Level Security" error?**
- Verify SQL policies were created
- Check user is authenticated
- Ensure UUID matches auth.uid()

**Database connection failed?**
- Check Supabase project is active
- Verify internet connection
- Check browser console for errors

---

Need help? Check the Supabase Discord: https://discord.supabase.com
