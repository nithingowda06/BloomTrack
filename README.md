# BloomTrack - Seller Management System

A modern seller management system with cloud-based PostgreSQL database (Neon) for real-time data synchronization across multiple users.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- A Neon PostgreSQL account ([Sign up here](https://console.neon.tech/))

### Setup Instructions

1. **Clone the repository**
```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

2. **Install dependencies**
```sh
npm install
```

3. **Set up Neon PostgreSQL Database**
   - Create a new project at [Neon Console](https://console.neon.tech/)
   - Copy your connection string
   - Run the SQL schema from `database/schema.sql` in the Neon SQL Editor

4. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your Neon connection string
   - Generate and set a secure `JWT_SECRET`

5. **Run the application**

Open two terminals:

**Terminal 1 - Backend Server:**
```sh
npm run server:dev
```

**Terminal 2 - Frontend:**
```sh
npm run dev
```

## 📚 Documentation

- 🎉 **[COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)** - What was accomplished
- 🚀 **[QUICK_START.md](./QUICK_START.md)** - Get started in 5 minutes
- 📖 **[SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)** - Detailed setup guide
- 🧪 **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Complete testing workflow
- 🌐 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
- 📋 **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Migration details
- ✅ **[CHECKLIST.md](./CHECKLIST.md)** - Verification checklist

## 🛠️ Helper Scripts

```bash
# Check if setup is complete
npm run check-setup

# Generate a secure JWT secret
npm run generate-secret

# Start backend server (development)
npm run server:dev

# Start frontend (development)
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## 🛠️ Technologies Used

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn-ui** - UI components
- **Lucide React** - Icons

### Backend
- **Express.js** - Web framework
- **Node.js** - Runtime
- **PostgreSQL (Neon)** - Cloud database
- **JWT** - Authentication
- **bcrypt** - Password hashing

## 🌐 Database Sharing

Since the database is hosted on Neon PostgreSQL cloud, multiple users can access the same data:

1. Share your Neon connection string with your friend
2. They update their `.env` file with the same `DATABASE_URL`
3. Both of you can now see and manage the same data in real-time!

## 📦 Project Structure

```
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── lib/               # API client and utilities
│   └── pages/             # Page components
├── server/                # Backend Express server
│   ├── routes/            # API routes
│   ├── middleware/        # Auth middleware
│   └── db.ts             # Database connection
├── database/              # Database schema
│   └── schema.sql        # PostgreSQL schema
└── .env                  # Environment variables
```

## 🔒 Security Notes

- Never commit your `.env` file to version control
- Use strong, unique JWT secrets in production
- Neon PostgreSQL connections are SSL-encrypted by default
- Passwords are hashed using bcrypt before storage

## 📝 API Endpoints

- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Sign in
- `GET /api/profiles` - Get user profile
- `GET /api/sellers` - Get all sellers
- `GET /api/sellers/search?query=` - Search sellers
- `POST /api/sellers` - Create seller
- `PUT /api/sellers/:id` - Update seller
- `DELETE /api/sellers/:id` - Delete seller
