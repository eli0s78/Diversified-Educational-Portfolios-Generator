# Complete Setup Guide: BERTopic Service + DEP App

This guide will help you set up both the **local** and **Railway** versions of your Diversified Educational Portfolios (DEP) app with the BERTopic microservice.

---

## 🎯 Quick Overview

You have two components:
1. **Main DEP App** (Next.js) - Currently running at http://localhost:3000
2. **BERTopic Microservice** (Python FastAPI) - Needs to be set up

---

## 📋 Prerequisites

- ✅ Node.js 18+ installed
- ✅ Python 3.9+ installed
- ✅ Git installed
- ⚠️ Railway CLI installed (already done)
- ⚠️ Railway account (sign up at railway.app)

---

## 🚀 PART 1: Local Setup (Development)

### Step 1: Set Up BERTopic Service Locally

#### 1.1 Open a NEW terminal (keep your current one running the DEP app)

On Windows PowerShell or Command Prompt:

```bash
cd a:\AI\Antigravity\Diversified-Educational-Portfolios-Generator\bertopic-service
```

#### 1.2 Create Python Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# You should see (venv) in your terminal prompt
```

#### 1.3 Install Dependencies

```bash
pip install -r requirements.txt
```

This will install:
- fastapi
- uvicorn
- bertopic
- sentence-transformers
- numpy
- pydantic

**⏱️ Note**: First installation takes 3-5 minutes (downloading ML models).

#### 1.4 Start the BERTopic Service

```bash
uvicorn main:app --reload --port 8000
```

**Expected output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

#### 1.5 Verify It's Working

Open your browser and go to:
- **Service info**: http://localhost:8000
- **API docs**: http://localhost:8000/docs
- **Health check**: http://localhost:8000/health

You should see:
```json
{
  "service": "BERTopic Microservice",
  "version": "1.0.0",
  "endpoints": {
    "topic_modeling": "/api/topic-modeling",
    "health": "/health"
  }
}
```

✅ **Success!** Your BERTopic service is now running locally on port 8000.

---

### Step 2: Configure DEP App to Use Local BERTopic Service

#### 2.1 Open your DEP app (should still be running at http://localhost:3000)

#### 2.2 Go to Settings

Click **Settings** in the navigation menu.

#### 2.3 Scroll down to "Research & Data Collection APIs"

#### 2.4 Set BERTopic Service URL

In the **"BERTopic Service URL"** field, enter:

```
http://localhost:8000
```

#### 2.5 Click "Save Settings"

✅ **Done!** Your DEP app is now connected to your local BERTopic service.

---

### Step 3: Test the Research Wizard

#### 3.1 Go to Upload page

Click **Upload** in the navigation menu.

#### 3.2 Click "Generate Data" tab

You should see the Research Wizard interface.

#### 3.3 Test with a sample occupation

Enter:
- **Occupation**: Software Developers
- **Region**: Global
- **Language**: English

Click **"Generate Research Data"**

#### 3.4 Watch the progress

The wizard will:
1. ✅ Collect academic papers (~30-60 seconds)
2. ✅ Run topic modeling via your local BERTopic service (~10-30 seconds)
3. ✅ Collect labor market data (~10-20 seconds)
4. ✅ Generate sector report with AI (~60-120 seconds)

**Total time**: 2-4 minutes

✅ **If successful**, you should see:
- Papers count
- Topics count
- Technologies count
- "Research Complete!" message

---

## 🌐 PART 2: Railway Deployment (Production)

### Why Deploy to Railway?

- ✅ **FREE**: $5/month credits (enough for ~500k requests)
- ✅ **Fast**: Auto-sleep + quick wake (~1-2 seconds)
- ✅ **Easy**: Auto-detects Python, no config needed
- ✅ **Reliable**: Better than Render's free tier

---

### Step 1: Deploy BERTopic Service to Railway

#### 1.1 Create Railway Account

1. Go to [railway.app](https://railway.app/)
2. Click **"Login"**
3. Sign in with **GitHub** (recommended)

#### 1.2 Create New Project

1. In Railway dashboard, click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub
4. Select your repository: `Diversified-Educational-Portfolios-Generator`

#### 1.3 Configure the Deployment

Railway will show all files. You need to tell it to deploy only the `bertopic-service` directory:

1. Click **"Settings"** (left sidebar)
2. Scroll to **"Service Settings"**
3. Set **Root Directory**: `bertopic-service`
4. Railway will auto-detect `requirements.txt` and use Python runtime

#### 1.4 Deploy

1. Click **"Deploy"**
2. Railway will:
   - Install Python dependencies (~3-5 minutes first time)
   - Start the FastAPI server with `uvicorn`
   - Assign a public URL

#### 1.5 Generate Public Domain

1. Once deployed (status = "Active"), go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Railway will give you a URL like: `https://bertopic-service-production-XXXX.up.railway.app`
4. **Copy this URL** - you'll need it in Step 2

#### 1.6 Verify Deployment

Open the URL in your browser. You should see:

```json
{
  "service": "BERTopic Microservice",
  "version": "1.0.0",
  "endpoints": {
    "topic_modeling": "/api/topic-modeling",
    "health": "/health"
  }
}
```

✅ **Success!** Your BERTopic service is now live on Railway.

---

### Step 2: Deploy DEP App to Railway

#### 2.1 Create Another New Project

1. In Railway dashboard, click **"New Project"** again
2. Select **"Deploy from GitHub repo"**
3. Choose the SAME repository: `Diversified-Educational-Portfolios-Generator`

#### 2.2 Configure DEP App Deployment

This time, deploy the main app (not bertopic-service):

1. Click **"Settings"** (left sidebar)
2. **Root Directory**: Leave EMPTY (deploy from root)
3. **Build Command**: `npm run build`
4. **Start Command**: `npm start`
5. Railway will auto-detect `package.json` and use Node.js runtime

#### 2.3 Set Environment Variables

1. Click **"Variables"** (left sidebar)
2. Add the following variables:

| Variable Name | Value |
|--------------|-------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_BERTOPIC_SERVICE_URL` | `https://your-bertopic-service.up.railway.app` (from Step 1.5) |

Replace `your-bertopic-service.up.railway.app` with your actual BERTopic service URL from Step 1.5.

#### 2.4 Deploy

1. Click **"Deploy"**
2. Railway will:
   - Install Node.js dependencies (~2-3 minutes)
   - Build Next.js app (~3-5 minutes)
   - Start the production server

#### 2.5 Generate Public Domain

1. Once deployed, go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Railway will give you a URL like: `https://dep-app-production-XXXX.up.railway.app`

#### 2.6 Open Your Deployed App

Open the URL in your browser. Your DEP app is now live! 🎉

---

### Step 3: Configure BERTopic URL in Deployed App

#### 3.1 Open your deployed DEP app

Go to: `https://your-dep-app.up.railway.app`

#### 3.2 Go to Settings

#### 3.3 Set BERTopic Service URL

In the **"BERTopic Service URL"** field, enter your Railway BERTopic URL:

```
https://your-bertopic-service.up.railway.app
```

#### 3.4 Save Settings

✅ **Done!** Your deployed app is now connected to your deployed BERTopic service.

---

## 🧪 Testing Your Deployment

### Test BERTopic Service

```bash
curl https://your-bertopic-service.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "bertopic-microservice",
  "version": "1.0.0"
}
```

### Test DEP App Research Wizard

1. Go to **Upload** → **"Generate Data"** tab
2. Enter occupation: "Data Analysts"
3. Click "Generate Research Data"
4. Wait for pipeline to complete (~2-4 minutes first time, ~1-2 minutes after)

---

## 🔑 Optional: Configure Research API Keys

To use advanced features (Exa, Tavily, Firecrawl), add API keys in Settings:

### Free Tier API Keys

1. **Semantic Scholar**: No key needed (1 req/sec)
2. **OpenAlex**: No key needed (unlimited)
3. **O*NET**: Register at [services.onetcenter.org](https://services.onetcenter.org/) (free)
4. **BLS**: Register at [api.bls.gov](https://www.bls.gov/developers/) (free, 500 daily queries)
5. **Tavily**: Sign up at [tavily.com](https://tavily.com/) (1K req/month free)
6. **Firecrawl**: Sign up at [firecrawl.dev](https://www.firecrawl.dev/) (500 credits free)
7. **Exa**: (Optional) Sign up at [exa.ai](https://exa.ai/) (paid, $25/month)

---

## 📊 What You Have Now

### Local Development Setup ✅

- **Main DEP App**: http://localhost:3000
- **BERTopic Service**: http://localhost:8000
- **Both connected and working**

### Railway Production Setup ✅

- **Main DEP App**: https://your-dep-app.up.railway.app
- **BERTopic Service**: https://your-bertopic-service.up.railway.app
- **Both deployed and connected**

---

## 🛠️ Troubleshooting

### Issue: "BERTopic service URL not configured"

**Solution**: Make sure you've set the URL in Settings (see Step 2 above).

### Issue: "Failed to fetch from BERTopic service"

**Causes**:
1. BERTopic service not running (check http://localhost:8000 or Railway URL)
2. CORS error (should be fixed, but check browser console)
3. Wrong URL format (should NOT have trailing slash)

**Solution**:
- Verify service is running: `curl http://localhost:8000/health`
- Check service logs in Railway dashboard
- Ensure URL has NO trailing slash: `http://localhost:8000` NOT `http://localhost:8000/`

### Issue: Python dependencies installation failed

**Solution**:
```bash
# Upgrade pip first
python -m pip install --upgrade pip

# Try installing again
pip install -r requirements.txt
```

### Issue: Railway deployment failed

**Causes**:
1. Root directory not set correctly
2. Build command not set
3. Python version incompatible

**Solution**:
- For BERTopic: Set Root Directory to `bertopic-service`
- For DEP App: Leave Root Directory empty
- Check deployment logs in Railway dashboard

### Issue: Out of Railway credits

**Solution**:
- Railway free tier: $5/month in credits
- Typical usage: ~$0.01 per topic modeling request
- 500k requests/month should be sufficient
- If you exceed, upgrade to Hobby plan ($5/month base)

---

## 💰 Cost Summary

### Local Development
- **Cost**: FREE
- **Hardware**: Uses your computer's CPU/RAM
- **Internet**: Only for API calls (Semantic Scholar, O*NET, etc.)

### Railway Deployment
- **BERTopic Service**: ~$0.50-$2/month (depending on usage)
- **DEP App**: ~$1-$3/month (depending on traffic)
- **Total**: ~$1.50-$5/month (within FREE $5 credit!)

### API Costs (Pay-per-use)
- **Gemini API**: ~$0.50 per sector report (EN+EL)
- **Other APIs**: All FREE (Semantic Scholar, OpenAlex, O*NET, BLS, ESCO, Eurostat)
- **Optional APIs**: Tavily (1K free), Firecrawl (500 credits free), Exa (paid only)

**Total estimated cost**: ~$5-10/month for moderate usage

---

## 🎉 Next Steps

1. ✅ Test local setup with a sample occupation
2. ✅ Deploy both services to Railway
3. ✅ Configure API keys in Settings (optional but recommended)
4. ✅ Generate sector reports for multiple occupations
5. ✅ Explore the full pipeline: Upload → Analysis → Portfolio → Courses → Export

---

## 📚 Additional Resources

- **BERTopic Documentation**: [maartengr.github.io/BERTopic](https://maartengr.github.io/BERTopic/)
- **Railway Documentation**: [docs.railway.app](https://docs.railway.app/)
- **FastAPI Documentation**: [fastapi.tiangolo.com](https://fastapi.tiangolo.com/)
- **Next.js Documentation**: [nextjs.org/docs](https://nextjs.org/docs)

---

**Need help?** Check:
1. Railway logs (deployment tab)
2. Browser console (F12 → Console)
3. BERTopic service health: `/health` endpoint
4. API docs: `/docs` endpoint

---

**🚀 You're all set!** Start generating sector reports for any occupation! 🎓
