# 🚀 Production Deployment Guide

Deploy your BloomTrack application to production so you and your friend can access it from anywhere!

## Architecture Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   Backend   │─────▶│    Neon     │
│  (Vercel)   │      │  (Railway)  │      │ PostgreSQL  │
└─────────────┘      └─────────────┘      └─────────────┘
```

## Option 1: Deploy Backend to Railway (Recommended)

### Why Railway?
- Free tier available
- Easy deployment
- Automatic HTTPS
- Environment variables management

### Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Configure Build Settings**
   - Root Directory: `/`
   - Build Command: `npm install`
   - Start Command: `npm run server`

4. **Set Environment Variables**
   Go to Variables tab and add:
   ```
   DATABASE_URL=your_neon_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=3001
   NODE_ENV=production
   ```

5. **Deploy**
   - Railway will automatically deploy
   - Copy your deployment URL (e.g., `https://your-app.railway.app`)

## Option 2: Deploy Backend to Render

### Steps:

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your repository

3. **Configure Service**
   - Name: bloomtrack-backend
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm run server`

4. **Set Environment Variables**
   ```
   DATABASE_URL=your_neon_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=3001
   NODE_ENV=production
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment
   - Copy your service URL

## Deploy Frontend to Vercel

### Steps:

1. **Create Vercel Account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New..." → "Project"
   - Import your repository

3. **Configure Project**
   - Framework Preset: Vite
   - Root Directory: `/`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Set Environment Variables**
   ```
   VITE_API_URL=https://your-backend-url.railway.app/api
   ```
   ⚠️ Replace with your actual backend URL!

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment
   - Your app will be live at `https://your-app.vercel.app`

## Alternative: Deploy Frontend to Netlify

### Steps:

1. **Create Netlify Account**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with GitHub

2. **Import Project**
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select your repo

3. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Set Environment Variables**
   Go to Site settings → Environment variables:
   ```
   VITE_API_URL=https://your-backend-url.railway.app/api
   ```

5. **Deploy**
   - Click "Deploy site"
   - Your app will be live at `https://your-app.netlify.app`

## Post-Deployment Configuration

### 1. Update CORS Settings

In `server/index.ts`, update CORS configuration:

```typescript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://your-app.vercel.app',  // Add your frontend URL
    'https://your-app.netlify.app'  // If using Netlify
  ],
  credentials: true
}));
```

### 2. Test Production Deployment

1. Visit your frontend URL
2. Sign up for a new account
3. Add a seller
4. Search for the seller
5. Verify all operations work

### 3. Share with Your Friend

Send your friend:
- Frontend URL: `https://your-app.vercel.app`
- They can create their own account
- All data is shared via the same Neon database

## Environment Variables Summary

### Backend (.env or Railway/Render Variables)
```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=your_secure_random_secret_key
PORT=3001
NODE_ENV=production
```

### Frontend (Vercel/Netlify Variables)
```env
VITE_API_URL=https://your-backend-url.railway.app/api
```

## Security Best Practices

### 1. Secure Your JWT Secret
- Use a strong, random secret (32+ characters)
- Never commit it to version control
- Use different secrets for dev and production

### 2. Database Security
- Neon PostgreSQL uses SSL by default
- Keep your connection string private
- Regularly rotate credentials

### 3. CORS Configuration
- Only allow your frontend domains
- Don't use `*` in production

### 4. Rate Limiting (Optional)
Add rate limiting to prevent abuse:

```bash
npm install express-rate-limit
```

In `server/index.ts`:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Monitoring and Maintenance

### 1. Set Up Error Logging
Consider using:
- [Sentry](https://sentry.io) for error tracking
- [LogRocket](https://logrocket.com) for session replay

### 2. Database Backups
- Neon provides automatic backups
- Set up additional backup schedule if needed
- Test restore process regularly

### 3. Performance Monitoring
- Monitor API response times
- Check database query performance
- Set up uptime monitoring (e.g., UptimeRobot)

## Scaling Considerations

### When to Scale:

1. **Database**: Upgrade Neon plan if you exceed free tier limits
2. **Backend**: Railway/Render auto-scale, or upgrade plan
3. **Frontend**: Vercel/Netlify handle scaling automatically

### Performance Optimization:

1. **Add Database Indexes** (already included in schema)
2. **Implement Caching** (Redis for frequently accessed data)
3. **Use CDN** (Vercel/Netlify provide this automatically)
4. **Optimize Queries** (use EXPLAIN ANALYZE in PostgreSQL)

## Cost Estimation

### Free Tier Limits:

- **Neon PostgreSQL**: 
  - 3 GB storage
  - 100 hours compute time/month
  - Unlimited databases

- **Railway**: 
  - $5 free credit/month
  - ~500 hours of usage

- **Vercel**: 
  - 100 GB bandwidth/month
  - Unlimited deployments

- **Netlify**: 
  - 100 GB bandwidth/month
  - 300 build minutes/month

### Estimated Monthly Cost:
- **Small usage** (you + friend): **$0** (free tier)
- **Medium usage** (10-50 users): **$10-25/month**
- **Large usage** (100+ users): **$50-100/month**

## Troubleshooting Production Issues

### Backend not responding?
- Check Railway/Render logs
- Verify environment variables are set
- Test database connection

### Frontend can't connect to backend?
- Verify `VITE_API_URL` is correct
- Check CORS settings
- Inspect browser console for errors

### Database connection errors?
- Verify Neon connection string
- Check if database is active
- Review Neon dashboard for issues

### Slow performance?
- Check Neon query performance
- Review backend logs for slow endpoints
- Consider adding caching

## Rollback Strategy

If something goes wrong:

1. **Railway/Render**: Rollback to previous deployment
2. **Vercel/Netlify**: Revert to previous deployment
3. **Database**: Restore from Neon backup

## CI/CD (Optional)

Set up automatic deployments:

1. **GitHub Actions** for automated testing
2. **Vercel/Netlify** auto-deploy on push to main
3. **Railway/Render** auto-deploy on push to main

## Support and Resources

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Neon Docs**: https://neon.tech/docs
- **Render Docs**: https://render.com/docs

---

## 🎉 Congratulations!

Your BloomTrack application is now live and accessible from anywhere! Share the URL with your friend and start managing sellers together.

**Production URL**: `https://your-app.vercel.app`

Remember to:
- ✅ Monitor your application regularly
- ✅ Keep dependencies updated
- ✅ Back up your database
- ✅ Review security practices

Happy deploying! 🚀
