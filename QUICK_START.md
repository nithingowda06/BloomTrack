# 🚀 Quick Start Guide

Get your BloomTrack application running in 5 minutes!

## Step 1: Verify Setup (30 seconds)

```bash
npm run check-setup
```

This will verify that everything is configured correctly.

## Step 2: Generate JWT Secret (10 seconds)

```bash
npm run generate-secret
```

Copy the generated secret and paste it in your `.env` file as `JWT_SECRET`.

## Step 3: Set Up Neon Database (2 minutes)

1. Go to [Neon Console](https://console.neon.tech/)
2. Click "Create Project"
3. Copy your connection string
4. Paste it in `.env` as `DATABASE_URL`
5. In Neon Console, go to SQL Editor
6. Copy the contents of `database/schema.sql`
7. Paste and run it in the SQL Editor

## Step 4: Start the Application (1 minute)

Open **two terminals**:

### Terminal 1 - Backend:
```bash
npm run server:dev
```

Wait for: `Server is running on port 3001`

### Terminal 2 - Frontend:
```bash
npm run dev
```

Wait for: `Local: http://localhost:5173/`

## Step 5: Test It! (1 minute)

1. Open `http://localhost:5173` in your browser
2. Click "Sign Up"
3. Create an account
4. Add a seller
5. Search for the seller

## ✅ Success!

If everything works, you're ready to go!

## 🤝 Share with Your Friend

To let your friend access the same database:

1. Share your `DATABASE_URL` from `.env`
2. They update their `.env` with the same `DATABASE_URL`
3. They run the same steps above
4. Both of you will see the same data!

## 📚 Need More Help?

- **Detailed Setup**: See [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)
- **Testing Guide**: See [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Migration Info**: See [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)

## 🆘 Troubleshooting

### Backend won't start?
- Check if `DATABASE_URL` is correct in `.env`
- Make sure port 3001 is not in use

### Frontend can't connect?
- Ensure backend is running first
- Check `VITE_API_URL` in `.env` is `http://localhost:3001/api`

### Database errors?
- Verify you ran `database/schema.sql` in Neon
- Check your Neon connection string is correct

## 🎯 What's Next?

After testing locally:
1. Deploy backend to Railway/Render/Heroku
2. Deploy frontend to Vercel/Netlify
3. Update environment variables for production
4. Share the production URL with your friend!

---

**Happy Coding! 🎉**
