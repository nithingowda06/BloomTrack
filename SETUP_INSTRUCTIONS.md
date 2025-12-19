# Migration to Neon PostgreSQL - Setup Instructions

This application has been migrated from Supabase to Neon PostgreSQL with a custom Express backend.

## Prerequisites

1. Node.js (v18 or higher)
2. A Neon PostgreSQL account and database

## Setup Steps

### 1. Create a Neon PostgreSQL Database

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy your connection string (it looks like: `postgresql://user:password@host/database?sslmode=require`)

### 2. Set Up the Database Schema

1. In your Neon Console, go to the SQL Editor
2. Run the SQL script from `database/schema.sql` to create all necessary tables:
   - `users` table for authentication
   - `profiles` table for user profiles
   - `sellers` table for seller records

Alternatively, you can use a PostgreSQL client like `psql` or any database GUI tool to run the schema.

### 3. Configure Environment Variables

Update the `.env` file in the root directory with your actual values:

```env
# Frontend API URL (keep as is for local development)
VITE_API_URL=http://localhost:3001/api

# Backend Database Connection - REPLACE THIS with your Neon connection string
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# JWT Secret - REPLACE THIS with a secure random string
JWT_SECRET=your_secure_random_secret_key_here

# Server Port
PORT=3001
```

**Important:** 
- Replace `DATABASE_URL` with your actual Neon PostgreSQL connection string
- Replace `JWT_SECRET` with a secure random string (you can generate one using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

You need to run both the backend server and the frontend:

**Terminal 1 - Backend Server:**
```bash
npm run server:dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The backend will run on `http://localhost:3001` and the frontend on `http://localhost:5173` (or another port if 5173 is busy).

## Architecture Overview

### Backend (Express + PostgreSQL)
- **Location:** `server/` directory
- **Database:** Neon PostgreSQL (cloud-hosted)
- **Authentication:** JWT-based authentication
- **API Endpoints:**
  - `POST /api/auth/signup` - Create new account
  - `POST /api/auth/signin` - Sign in
  - `GET /api/auth/user` - Get current user
  - `POST /api/auth/signout` - Sign out
  - `GET /api/profiles` - Get user profile
  - `PUT /api/profiles` - Update profile
  - `GET /api/sellers` - Get all sellers
  - `GET /api/sellers/search?query=` - Search sellers
  - `POST /api/sellers` - Create seller
  - `PUT /api/sellers/:id` - Update seller
  - `DELETE /api/sellers/:id` - Delete seller

### Frontend (React + Vite)
- **Location:** `src/` directory
- **API Client:** `src/lib/api.ts`
- **Authentication:** Token stored in localStorage

## Database Schema

### users
- `id` (UUID, Primary Key)
- `email` (TEXT, Unique)
- `password` (TEXT, hashed with bcrypt)
- `created_at` (TIMESTAMPTZ)

### profiles
- `id` (UUID, Primary Key, Foreign Key to users)
- `owner_name` (TEXT)
- `mobile` (TEXT)
- `shop_name` (TEXT)
- `created_at` (TIMESTAMPTZ)

### sellers
- `id` (UUID, Primary Key)
- `owner_id` (UUID, Foreign Key to profiles)
- `name` (TEXT)
- `mobile` (TEXT)
- `serial_number` (TEXT, Unique)
- `address` (TEXT)
- `date` (DATE)
- `amount` (DECIMAL)
- `kg` (DECIMAL)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

## Sharing Database Access

Since the database is hosted on Neon PostgreSQL cloud:

1. **Share the connection string** with your friend
2. They need to:
   - Clone the repository
   - Update their `.env` file with the same `DATABASE_URL`
   - Run `npm install`
   - Start the backend and frontend

Both of you will be accessing the same cloud database, so all data will be synchronized automatically.

## Production Deployment

For production deployment:

1. **Backend:** Deploy to a service like Heroku, Railway, Render, or AWS
2. **Frontend:** Deploy to Vercel, Netlify, or any static hosting
3. **Update Environment Variables:**
   - Set `VITE_API_URL` to your deployed backend URL
   - Ensure `DATABASE_URL` and `JWT_SECRET` are set in your backend environment

## Troubleshooting

### Backend won't start
- Ensure PostgreSQL connection string is correct
- Check if port 3001 is available
- Verify all dependencies are installed

### Frontend can't connect to backend
- Ensure backend is running on port 3001
- Check `VITE_API_URL` in `.env`
- Check browser console for CORS errors

### Database connection errors
- Verify Neon PostgreSQL connection string
- Ensure your IP is allowed in Neon (usually allowed by default)
- Check if database schema is created

## Migration Notes

- All Supabase dependencies have been removed
- Authentication is now handled via JWT tokens
- Row Level Security (RLS) is implemented in the backend API
- All data operations go through the Express API server
