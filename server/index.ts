import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import sellerRoutes from './routes/sellers.js';
import adminRoutes from './routes/admin.js';
import reportsRoutes from './routes/reports.js';

dotenv.config();

// restart marker: pick up updated .env

// Check if JWT_SECRET is configured
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('your_secure_random_secret_key_here')) {
  console.error('\n❌ ERROR: JWT_SECRET is not configured in .env file');
  console.error('Please run: npm run generate-secret');
  console.error('Then copy the generated secret to your .env file as JWT_SECRET\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
