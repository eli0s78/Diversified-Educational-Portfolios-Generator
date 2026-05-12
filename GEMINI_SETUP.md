# Gemini API Server-Side Configuration

This application uses a **server-side Gemini API key** that is securely stored and never exposed to users. This guide explains how to configure it for both local development and production deployment.

## 🔐 Security Benefits

- ✅ **Single API Key**: You only need one Gemini API key for all users
- ✅ **Secure**: API key is stored server-side and never sent to client browsers
- ✅ **Cost Control**: You control all API usage and costs
- ✅ **Simple UX**: Users don't need to configure or provide their own API keys

---

## 📝 Getting Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Get API key"** or **"Create API key"**
3. Copy your API key (starts with `AIzaSy...`)
4. Keep it secure - treat it like a password!

---

## 💻 Local Development Setup

### Step 1: Configure Environment Variable

The `.env.local` file has been created in your project root. Open it and replace the placeholder with your actual Gemini API key:

```bash
# .env.local
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Optional: Specify default model (defaults to gemini-3.1-pro-preview)
GEMINI_MODEL_ID=gemini-3.1-pro-preview
```

**Important**: The `.env.local` file is already in `.gitignore` - it will NOT be committed to version control. ✅

### Step 2: Restart Development Server

After adding your API key, restart your dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 3: Verify It Works

1. Go to http://localhost:3001/en/settings
2. You should see: **"Gemini AI - Server Configured ✅"**
3. Try generating a portfolio to confirm AI features work

---

## 🚂 Railway Production Deployment

### Step 1: Add Environment Variable to Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Navigate to **"Variables"** tab
4. Click **"+ New Variable"**
5. Add:
   - **Variable Name**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key (e.g., `AIzaSyXXX...`)
6. Click **"Add"**

### Step 2: (Optional) Set Custom Model

If you want to use a specific Gemini model:

1. Add another variable:
   - **Variable Name**: `GEMINI_MODEL_ID`
   - **Value**: `gemini-3.1-pro-preview` (or your preferred model)

### Step 3: Deploy

Railway will automatically redeploy your service with the new environment variables. No code changes needed!

### Step 4: Verify Production

1. Visit your Railway deployment URL
2. Go to Settings page
3. Confirm you see: **"Gemini AI - Server Configured ✅"**

---

## 🔧 How It Works

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│   Browser   │────────▶│  Next.js API │────────▶│  Gemini API    │
│   (User)    │         │   (Server)   │         │  (Google)      │
└─────────────┘         └──────────────┘         └────────────────┘
                             │
                             │ Reads GEMINI_API_KEY
                             │ from environment
                             ▼
                        ┌──────────┐
                        │ .env.local│ (Local)
                        │  Railway  │ (Production)
                        └──────────┘
```

### Files Involved

1. **`.env.local`** - Stores API key locally (git-ignored)
2. **`lib/server-config.ts`** - Helper functions to access server-side config
3. **`app/api/analyze/route.ts`** - Uses server key for topic analysis
4. **`app/api/generate/route.ts`** - Uses server key for course generation
5. **`app/api/generate-report/route.ts`** - Uses server key for report generation

### Client-Side Changes

The Settings UI now shows a **read-only** informational card instead of an API key input field:

```tsx
{/* Gemini AI - Server-Side Configured */}
<Card>
  <Badge variant="success">Server Configured</Badge>
  <p>AI generation is enabled and ready to use</p>
  <p>The Gemini API key is securely configured on the server.</p>
</Card>
```

---

## 🧪 Testing

### Test Locally

1. **Upload Tab** - Upload sample data and run analysis
2. **Portfolio Tab** - Generate an optimized portfolio
3. **Courses Tab** - Generate AI courses
4. **Research Tab** - Generate research reports

All AI operations should work without users providing any API key.

### Test on Railway

Same tests as above, but on your deployed Railway URL.

---

## ❓ Troubleshooting

### Error: "GEMINI_API_KEY is not set in environment variables"

**Local Development:**
- Make sure `.env.local` exists in project root
- Verify the file contains `GEMINI_API_KEY=AIzaSy...`
- Restart your dev server after adding the key

**Railway Production:**
- Check that you added `GEMINI_API_KEY` in Railway Variables tab
- Wait for automatic redeployment to complete
- Check Railway logs for any errors

### Error: "Invalid API key"

- Verify your key is correct by testing it at [Google AI Studio](https://aistudio.google.com/app/apikey)
- Make sure there are no extra spaces or quotes around the key
- Confirm the key hasn't expired or been revoked

### Changes not taking effect

**Local:**
```bash
# Stop server (Ctrl+C)
# Clear Next.js cache
rm -rf .next
# Restart
npm run dev
```

**Railway:**
- Changes to environment variables trigger automatic redeployment
- Check Railway logs to confirm redeployment started
- May take 2-3 minutes for changes to take effect

---

## 🔒 Security Best Practices

### ✅ DO:
- Keep your API key secret
- Use different keys for development and production (if needed)
- Monitor your Gemini API usage in Google AI Studio
- Set up usage alerts in Google Cloud Console

### ❌ DON'T:
- Don't commit `.env.local` to Git (it's already in `.gitignore`)
- Don't share your API key in screenshots, logs, or error messages
- Don't hardcode the API key directly in your code
- Don't expose it through client-side code or public endpoints

---

## 💰 Cost Management

### Free Tier Limits
- Gemini API has a free tier with rate limits
- Check current limits: https://ai.google.dev/pricing

### Monitor Usage
1. Go to [Google AI Studio](https://aistudio.google.com)
2. View your quota and usage
3. Set up billing alerts if using paid tier

### Rate Limiting
The app respects Gemini's rate limits. If you exceed them:
- Free tier: Requests will fail temporarily
- Paid tier: You'll be charged according to Google's pricing

---

## 🆘 Support

### Documentation
- Gemini API Docs: https://ai.google.dev/docs
- Next.js Environment Variables: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
- Railway Docs: https://docs.railway.app/guides/variables

### Issues
If you encounter problems:
1. Check the troubleshooting section above
2. Review Railway deployment logs
3. Test your API key directly in Google AI Studio
4. Open an issue on GitHub with error details

---

## ✅ Checklist

### Local Development
- [ ] Created `.env.local` file in project root
- [ ] Added `GEMINI_API_KEY` with your actual key
- [ ] Restarted dev server
- [ ] Verified "Server Configured ✅" appears in Settings
- [ ] Tested AI generation (upload, analyze, generate courses)

### Railway Deployment
- [ ] Added `GEMINI_API_KEY` environment variable in Railway
- [ ] (Optional) Added `GEMINI_MODEL_ID` if using custom model
- [ ] Waited for automatic redeployment
- [ ] Verified production deployment works
- [ ] Tested AI generation on production URL

---

**🎉 Congratulations!** Your Gemini API is now securely configured server-side. Users can use all AI features without needing their own API keys!
