# Testing Guide

## Pre-Testing Checklist

Before testing, ensure:
- ✅ Neon PostgreSQL database is created
- ✅ Database schema is executed (`database/schema.sql`)
- ✅ `.env` file is configured with correct values
- ✅ Dependencies are installed (`npm install`)

## Starting the Application

### Step 1: Start Backend Server
```bash
npm run server:dev
```

**Expected Output:**
```
Server is running on port 3001
```

**Troubleshooting:**
- If you see database connection errors, verify your `DATABASE_URL` in `.env`
- If port 3001 is busy, change `PORT` in `.env` and update `VITE_API_URL` accordingly

### Step 2: Start Frontend
Open a new terminal:
```bash
npm run dev
```

**Expected Output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

## Testing Workflow

### 1. Test User Registration

1. Open `http://localhost:5173` in your browser
2. Click "Don't have an account? Sign Up"
3. Fill in the form:
   - Owner Name: Test User
   - Mobile: 1234567890
   - Shop Name: Test Shop
   - Email: test@example.com
   - Password: password123
4. Click "Sign Up"

**Expected Result:**
- ✅ Success toast: "Account created successfully!"
- ✅ Automatically redirected to Dashboard
- ✅ Profile card shows your shop details

**Check Database:**
```sql
SELECT * FROM users;
SELECT * FROM profiles;
```

### 2. Test User Login

1. Sign out from the dashboard
2. Enter your credentials:
   - Email: test@example.com
   - Password: password123
3. Click "Sign In"

**Expected Result:**
- ✅ Success toast: "Signed in successfully!"
- ✅ Redirected to Dashboard

### 3. Test Add Seller

1. Click "Add Seller" button
2. Fill in the form:
   - Seller Name: John Doe
   - Mobile: 9876543210
   - Serial Number: SN001
   - Address: 123 Main Street
   - Date: (today's date)
   - Amount: 1000
   - Weight: 50
3. Click "Add Seller"

**Expected Result:**
- ✅ Success toast: "Seller added successfully!"
- ✅ Dialog closes

**Check Database:**
```sql
SELECT * FROM sellers;
```

### 4. Test Search Seller

1. In the search box, enter: SN001
2. Click "Search"

**Expected Result:**
- ✅ Success toast: "Found 1 record(s)"
- ✅ Table displays the seller information
- ✅ Total Amount and Total Weight are calculated correctly

### 5. Test Edit Seller

1. After searching, click the Edit icon on a seller row
2. Modify some fields (e.g., change amount to 1500)
3. Click "Update"

**Expected Result:**
- ✅ Success toast: "Seller updated successfully!"
- ✅ Dialog closes
- ✅ Search again to verify changes

### 6. Test Add New Data (Same Seller)

1. After searching for a seller, click "Add New Data" button
2. Notice that name, mobile, serial number, and address are locked
3. Update only:
   - Date: (new date)
   - Amount: 800
   - Weight: 40
4. Click "Save"

**Expected Result:**
- ✅ Success toast: "Data updated successfully!"
- ✅ New entry created with same seller details but different amount/weight/date

**Check Database:**
```sql
SELECT * FROM sellers WHERE serial_number = 'SN001';
-- Should show multiple entries with same serial number
```

### 7. Test Delete Seller

1. Search for a seller
2. Click the "Delete" button
3. Confirm deletion in the dialog

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ Success toast: "Seller deleted successfully!"
- ✅ Seller removed from the table

### 8. Test Multi-User Access

**On Your Computer:**
1. Add a seller with serial number SN002

**On Your Friend's Computer:**
1. Ensure they have the same `DATABASE_URL` in their `.env`
2. Start their backend and frontend
3. Sign in with their own account (or the same account)
4. Search for SN002

**Expected Result:**
- ✅ Your friend can see the seller you just added
- ✅ Both of you are accessing the same cloud database

### 9. Test Authentication

1. Try accessing the dashboard without logging in
2. Open browser DevTools → Application → Local Storage
3. Delete the `auth_token` key
4. Refresh the page

**Expected Result:**
- ✅ Redirected to login page
- ✅ Cannot access dashboard without authentication

### 10. Test Search Functionality

Test various search queries:
- Exact serial number: `SN001`
- Partial serial number: `SN`
- Seller name: `John`
- Mobile number: `9876`
- Address: `Main`

**Expected Result:**
- ✅ All matching records are displayed
- ✅ Search is case-insensitive
- ✅ Partial matches work

## API Testing (Optional)

You can test the API directly using tools like Postman or curl:

### Sign Up
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "api@test.com",
    "password": "password123",
    "owner_name": "API User",
    "mobile": "1111111111",
    "shop_name": "API Shop"
  }'
```

### Sign In
```bash
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "api@test.com",
    "password": "password123"
  }'
```

Copy the `token` from the response and use it in subsequent requests:

### Get Profile
```bash
curl http://localhost:3001/api/profiles \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Create Seller
```bash
curl -X POST http://localhost:3001/api/sellers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "API Seller",
    "mobile": "2222222222",
    "serial_number": "API001",
    "address": "API Address",
    "date": "2025-10-11",
    "amount": 2000,
    "kg": 100
  }'
```

### Search Sellers
```bash
curl "http://localhost:3001/api/sellers/search?query=API" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Common Issues and Solutions

### Issue: "Cannot connect to database"
**Solution:** 
- Verify `DATABASE_URL` in `.env`
- Ensure Neon database is running
- Check if your IP is allowed (Neon allows all by default)

### Issue: "Port 3001 already in use"
**Solution:**
- Change `PORT` in `.env` to another port (e.g., 3002)
- Update `VITE_API_URL` to match the new port

### Issue: "Invalid or expired token"
**Solution:**
- Clear localStorage in browser DevTools
- Sign in again

### Issue: "Serial number already exists"
**Solution:**
- This is expected behavior for unique serial numbers
- Use a different serial number or use "Add New Data" feature

### Issue: Frontend can't connect to backend
**Solution:**
- Ensure backend is running on port 3001
- Check browser console for CORS errors
- Verify `VITE_API_URL` in `.env`

### Issue: TypeScript errors in server files
**Solution:**
- These are expected during development
- The server will still run correctly
- Ensure `ts-node` and `nodemon` are installed

## Performance Testing

### Test with Multiple Records
1. Add 50+ sellers with different serial numbers
2. Test search performance
3. Verify pagination works smoothly

### Test Concurrent Users
1. Open the app in multiple browser tabs/windows
2. Sign in with different accounts
3. Perform operations simultaneously
4. Verify data consistency

## Security Testing

### Test Authentication
- ✅ Cannot access API without token
- ✅ Invalid tokens are rejected
- ✅ Passwords are hashed (check database)

### Test Authorization
- ✅ Users can only see their own sellers
- ✅ Users cannot modify other users' data

## Success Criteria

Your migration is successful if:
- ✅ All CRUD operations work correctly
- ✅ Authentication and authorization function properly
- ✅ Multiple users can access the same database
- ✅ Data persists across sessions
- ✅ Search functionality works as expected
- ✅ No console errors in browser or server

## Next Steps After Testing

1. **Production Deployment:**
   - Deploy backend to Heroku/Railway/Render
   - Deploy frontend to Vercel/Netlify
   - Update environment variables

2. **Backup Strategy:**
   - Set up automated backups in Neon
   - Export data regularly

3. **Monitoring:**
   - Set up error logging
   - Monitor database performance
   - Track API response times

4. **Enhancements:**
   - Add data export features
   - Implement advanced filtering
   - Add analytics dashboard
   - Set up email notifications
