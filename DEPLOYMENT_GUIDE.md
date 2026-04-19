# Deployment Guide for Noor Al-Hoda

This guide explains how to deploy the Noor Al-Hoda application to **Vercel** (frontend) and **Railway** (backend) for free.

## Architecture

- **Frontend**: Next.js deployed on Vercel
- **Backend**: Django REST API deployed on Railway
- **Database**: PostgreSQL on Railway

## Prerequisites

1. GitHub account (for connecting repositories)
2. Vercel account (free tier)
3. Railway account (free tier)
4. Git installed locally

## Step 1: Prepare the Frontend for Vercel

### 1.1 Create a Vercel Account
- Go to [vercel.com](https://vercel.com) and sign up with GitHub

### 1.2 Deploy Frontend to Vercel
1. Push the repository to GitHub (if not already done)
2. Go to Vercel Dashboard → "Add New..." → "Project"
3. Import the GitHub repository `MahmoudAlmodalal/noor_alhoda`
4. Configure the project:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm ci`

### 1.3 Set Environment Variables in Vercel
Add the following environment variable:
- **Key**: `BACKEND_URL`
- **Value**: `https://<your-railway-backend-url>` (you'll get this after deploying the backend)

## Step 2: Deploy Backend to Railway

### 2.1 Create a Railway Account
- Go to [railway.app](https://railway.app) and sign up with GitHub

### 2.2 Create a PostgreSQL Database
1. In Railway Dashboard, click "New Project"
2. Select "Database" → "PostgreSQL"
3. Railway will create a free PostgreSQL database
4. Note the `DATABASE_URL` from the database service

### 2.3 Deploy Backend to Railway
1. In Railway Dashboard, click "New Project" → "Deploy from GitHub repo"
2. Select the `MahmoudAlmodalal/noor_alhoda` repository
3. Configure the service:
   - **Root Directory**: `backend`
   - **Framework**: Python
   - **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput`
   - **Start Command**: `gunicorn noor_alhuda.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120`

### 2.4 Set Environment Variables in Railway
Add the following environment variables:

| Variable | Value |
|----------|-------|
| `DJANGO_SETTINGS_MODULE` | `noor_alhuda.settings.production` |
| `DEBUG` | `False` |
| `SECRET_KEY` | Generate a secure key (use Django's `get_random_secret_key()`) |
| `ALLOWED_HOSTS` | `.railway.app,.vercel.app,.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://<your-vercel-frontend-url>,*.vercel.app,*.railway.app` |
| `CSRF_TRUSTED_ORIGINS` | `https://<your-vercel-frontend-url>,*.vercel.app,*.railway.app` |
| `DATABASE_URL` | (Auto-linked from PostgreSQL service) |

### 2.5 Generate Django Secret Key
Run this locally to generate a secure key:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Step 3: Connect Frontend and Backend

### 3.1 Get Backend URL from Railway
1. Go to Railway Dashboard → Your Backend Service
2. Copy the "Public URL" (e.g., `https://noor-alhoda-backend.railway.app`)

### 3.2 Update Vercel Environment Variable
1. Go to Vercel Dashboard → Your Frontend Project → Settings → Environment Variables
2. Update `BACKEND_URL` with the Railway backend URL
3. Redeploy the frontend (Vercel will auto-redeploy on environment variable changes)

## Step 4: Verify Deployment

### 4.1 Test Frontend
- Visit your Vercel frontend URL (e.g., `https://noor-alhoda.vercel.app`)
- Check if the app loads correctly

### 4.2 Test Backend API
- Visit `https://<railway-backend-url>/api/` to check if the API is accessible
- Visit `https://<railway-backend-url>/admin/` to access the Django admin panel

### 4.3 Test API Communication
- Try logging in on the frontend
- Check browser console for any CORS errors

## Troubleshooting

### Issue: CORS Errors
**Solution**: Ensure `CORS_ALLOWED_ORIGINS` in Railway environment variables includes your Vercel frontend URL.

### Issue: Database Connection Errors
**Solution**: Verify that `DATABASE_URL` is correctly set in Railway and linked to the PostgreSQL service.

### Issue: Static Files Not Loading
**Solution**: Run `python manage.py collectstatic --noinput` in Railway build command (already included).

### Issue: 404 on API Endpoints
**Solution**: Ensure the backend URL in Vercel's `BACKEND_URL` environment variable is correct and accessible.

## Free Tier Limits

- **Vercel**: 100 GB bandwidth/month, unlimited projects
- **Railway**: $5 free credit/month (usually sufficient for a small project)
- **PostgreSQL on Railway**: Free tier included

## Next Steps

1. Configure email notifications (optional)
2. Set up custom domain (optional)
3. Configure backups for the database (optional)
4. Monitor logs and performance

---

For more information:
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Django Deployment Guide](https://docs.djangoproject.com/en/stable/howto/deployment/)
