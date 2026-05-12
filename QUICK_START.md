# Quick Start Guide: Local Setup Complete!

## ✅ What's Already Running

### 1. **Main DEP App**
- URL: http://localhost:3000
- Status: **Running** ✅

### 2. **BERTopic Microservice**
- URL: http://localhost:8000
- Status: **Running** ✅
- Health: http://localhost:8000/health
- API Docs: http://localhost:8000/docs

---

## 🎯 Next Steps (2 minutes)

### Step 1: Configure BERTopic URL

The Settings page should now be open in your browser at: http://localhost:3000/en/settings

**What to do:**

1. Scroll down to **"Research & Data Collection APIs"**
2. Find the field: **"BERTopic Service URL"**
3. Enter: `http://localhost:8000`
4. Click **"Save Settings"**

✅ **Done!** Your app is now connected to the BERTopic service.

---

### Step 2: Test the Research Wizard

1. Go to **Upload** page: http://localhost:3000/en/upload
2. Click the **"Generate Data"** tab
3. Enter a test occupation:
   - **Occupation**: `Software Developers`
   - **Region**: `Global`
   - **Language**: `English`
4. Click **"Generate Research Data"**

**What will happen:**
1. ✅ Collect ~200 academic papers (30-60 seconds)
2. ✅ Run topic modeling with BERTopic (10-30 seconds)
3. ✅ Collect labor market data (10-20 seconds)
4. ✅ Generate AI sector report (60-120 seconds)

**Total time**: ~2-4 minutes

**Expected result**: You should see:
- Papers count
- Topics count
- Technologies count
- "Research Complete!" message

---

## 🚀 Railway Deployment (Optional)

When you're ready to deploy to Railway (for production use), follow the **complete guide** in [SETUP_GUIDE.md](./SETUP_GUIDE.md).

**Quick summary:**
1. Deploy BERTopic service to Railway (FREE $5/month credit)
2. Deploy main DEP app to Railway
3. Configure BERTopic URL in Settings to use Railway URL

**Cost**: ~$1-5/month (within FREE $5 credit!)

---

## 📊 What You Can Do Now

### ✅ Generate Sector Reports

For ANY occupation, the system will automatically:
1. Collect 200+ academic papers from Semantic Scholar + OpenAlex
2. Extract 15 topics using BERTopic (ML-powered clustering)
3. Gather labor market data (employment, wages, skills) from O*NET/BLS/ESCO/Eurostat
4. Analyze sector trends and technologies
5. Generate comprehensive AI report (bilingual: EN+EL)
6. Create affinity matrix for portfolio optimization
7. Generate diversified training portfolio
8. Generate course outlines for each training direction
9. Export to DOCX, PDF, SCORM 1.2

### ✅ Use Existing Upload System

Upload your own CSV files as before:
- Reports (PDF/TXT)
- Topics (CSV)
- Papers (CSV)

---

## 🛠️ Troubleshooting

### Issue: "BERTopic service URL not configured"

**Solution**: Set URL in Settings → "BERTopic Service URL" → `http://localhost:8000`

### Issue: "Failed to connect to BERTopic service"

**Check if service is running**:
```bash
curl http://localhost:8000/health
```

**Expected response**:
```json
{"status":"healthy","service":"bertopic-microservice","version":"1.0.0"}
```

**If not running**, start it again:
```bash
cd bertopic-service
./venv/Scripts/uvicorn.exe main:app --host 127.0.0.1 --port 8000
```

### Issue: Python dependencies error

**Solution**: Reinstall dependencies:
```bash
cd bertopic-service
rm -rf venv
python -m venv venv
./venv/Scripts/python.exe -m pip install --upgrade pip
./venv/Scripts/python.exe -m pip install -r requirements.txt
```

---

## 📚 Additional Resources

- **Complete Setup Guide**: [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Full local + Railway deployment instructions
- **BERTopic Service README**: [bertopic-service/README.md](./bertopic-service/README.md) - Service documentation
- **API Documentation**: http://localhost:8000/docs - Interactive API docs (when service is running)

---

## 🎉 You're All Set!

Your system is fully operational:
- ✅ Main app running
- ✅ BERTopic service running
- ✅ Ready to generate sector reports
- ✅ Ready to create diversified portfolios

**Start by testing with "Software Developers" or any other occupation!**

---

## 💡 Tips

1. **First run** may be slow (downloading ML models) - subsequent runs are faster
2. **BERTopic service** needs to stay running while using the Research Wizard
3. **Railway deployment** is optional - local dev works perfectly for testing
4. **API keys** (Semantic Scholar, O*NET, etc.) are optional - system has defaults

---

**Need help?** Check [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed instructions.

**Ready to deploy?** Follow Railway deployment section in SETUP_GUIDE.md.
