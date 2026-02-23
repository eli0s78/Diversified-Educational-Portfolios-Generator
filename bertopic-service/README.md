# BERTopic Microservice

A lightweight FastAPI microservice for topic modeling using BERTopic. Designed for FREE deployment on Railway or Render.

## Features

- **Topic Modeling**: BERTopic clustering with UMAP + HDBSCAN
- **Embeddings**: Sentence-Transformers (default: `all-MiniLM-L6-v2`)
- **Rarity Labeling**: Automatic COMMON/RARE/NO_TOPIC classification
- **RESTful API**: FastAPI with automatic OpenAPI docs
- **CORS Enabled**: Works with any frontend
- **Health Checks**: `/health` endpoint for deployment platforms

---

## 🚀 Deployment Options

### Option A: Deploy to Railway (Recommended - FREE $5/month credit)

Railway offers a generous free tier with $5/month in credits.

#### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app/)
2. Sign up with GitHub (recommended)

#### Step 2: Deploy from GitHub

1. Push this `bertopic-service` directory to a GitHub repository
2. In Railway dashboard, click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect `requirements.txt` and deploy Python

#### Step 3: Configure Environment

No environment variables needed! Railway will:
- Automatically install dependencies from `requirements.txt`
- Expose the service on a public URL
- Provide health checks via `/health`

#### Step 4: Get Your Service URL

1. Once deployed, go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://your-service.railway.app`)
4. Add this URL to your DEP app Settings page (BERTopic Service URL field)

#### Cost: FREE

- $5/month in credits (enough for ~500k requests/month)
- Sleeps after inactivity (wakes up in ~1-2 seconds)

---

### Option B: Deploy to Render (FREE tier available)

Render offers a free tier with some limitations (slow cold starts).

#### Step 1: Create Render Account

1. Go to [render.com](https://render.com/)
2. Sign up with GitHub

#### Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `bertopic-service`
   - **Region**: Choose closest to you
   - **Branch**: `main` (or your branch)
   - **Root Directory**: `bertopic-service`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

#### Step 3: Deploy

1. Click **"Create Web Service"**
2. Render will build and deploy (takes ~5-10 minutes first time)
3. Once live, copy the service URL (e.g., `https://bertopic-service.onrender.com`)
4. Add this URL to your DEP app Settings page

#### Cost: FREE

- Free tier: 750 hours/month
- ⚠️ **Cold starts**: Service sleeps after 15 min inactivity (takes ~30-60 seconds to wake)
- ⚠️ Limited CPU/RAM (may be slow for large datasets)

---

### Option C: Local Development

For testing locally before deployment:

#### Step 1: Install Dependencies

```bash
cd bertopic-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Step 2: Run Server

```bash
uvicorn main:app --reload --port 8000
```

#### Step 3: Test

Open http://localhost:8000 in your browser. You should see:

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

#### Step 4: API Docs

Visit http://localhost:8000/docs for interactive Swagger documentation.

---

## 📡 API Usage

### Endpoint: `/api/topic-modeling`

**Method**: `POST`

**Request Body**:

```json
{
  "papers": [
    {
      "id": "paper1",
      "title": "Machine Learning in Construction",
      "abstract": "This paper explores ML applications..."
    },
    {
      "id": "paper2",
      "title": "BIM and Digital Twins",
      "abstract": "Building Information Modeling..."
    }
  ],
  "min_topic_size": 8,
  "n_topics": null,
  "embedding_model": "all-MiniLM-L6-v2"
}
```

**Response**:

```json
{
  "topics": [
    {
      "topicNumber": 0,
      "count": 45,
      "name": "0_machine_learning_ai_automation",
      "representation": ["machine", "learning", "ai", "automation"],
      "representativeDocs": ["ML in Construction", "AI for BIM"],
      "rarityLabel": "COMMON"
    }
  ],
  "papers_with_topics": [
    {
      "id": "paper1",
      "title": "Machine Learning in Construction",
      "abstract": "...",
      "topicNumber": 0,
      "rarityLabel": "COMMON"
    }
  ],
  "metadata": {
    "n_topics": 15,
    "n_outliers": 12,
    "processing_time_ms": 5432
  }
}
```

---

## 🔧 Configuration

### Embedding Models

You can use any SentenceTransformer model:

- `all-MiniLM-L6-v2` (default, fast, 384 dims)
- `all-mpnet-base-v2` (better quality, slower, 768 dims)
- `paraphrase-multilingual-MiniLM-L12-v2` (multilingual)

### Memory Optimization

For free tiers with limited RAM:

1. Use smaller embedding models (`all-MiniLM-L6-v2`)
2. Process papers in batches (max ~200 papers per request)
3. Reduce `min_topic_size` if you have fewer papers

---

## 🧪 Testing

### Test with cURL

```bash
curl -X POST https://your-service.railway.app/api/topic-modeling \
  -H "Content-Type: application/json" \
  -d '{
    "papers": [
      {"id": "1", "title": "AI in healthcare", "abstract": "..."},
      {"id": "2", "title": "ML for diagnostics", "abstract": "..."}
    ],
    "min_topic_size": 2
  }'
```

### Test from JavaScript

```javascript
const response = await fetch('https://your-service.railway.app/api/topic-modeling', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    papers: [
      { id: '1', title: 'AI in healthcare', abstract: '...' },
      { id: '2', title: 'ML for diagnostics', abstract: '...' }
    ],
    min_topic_size: 2
  })
});

const data = await response.json();
console.log(data.topics);
```

---

## ⚠️ Limitations

### Railway Free Tier

- $5/month credits (~500k requests)
- Sleeps after inactivity (fast wake)
- 512 MB RAM (sufficient for ~200 papers)
- 1 GB storage

### Render Free Tier

- 750 hours/month
- Slow cold starts (15+ min inactivity)
- 512 MB RAM
- Very limited CPU

### Performance

- **Small datasets** (50-200 papers): 3-10 seconds
- **Medium datasets** (200-500 papers): 10-30 seconds
- **Large datasets** (500+ papers): May exceed free tier limits

---

## 🛠️ Troubleshooting

### Service won't start

- Check logs in Railway/Render dashboard
- Ensure `requirements.txt` is valid
- Try reducing dependency versions

### Out of memory errors

- Reduce `min_topic_size`
- Use smaller embedding model
- Process fewer papers per request

### Slow cold starts (Render)

- Upgrade to paid tier ($7/month)
- Or use Railway (faster wake times)

---

## 📊 Monitoring

### Health Check

```bash
curl https://your-service.railway.app/health
```

Expected response:

```json
{
  "status": "healthy",
  "service": "bertopic-microservice",
  "version": "1.0.0"
}
```

---

## 🔐 Security Notes

- ⚠️ This microservice has **NO authentication** by default
- For production, add API key authentication
- Use environment variables for sensitive config
- Consider rate limiting for public deployments

---

## 📝 License

MIT License - Free to use and modify.

---

## 🆘 Support

For issues or questions:

1. Check Railway/Render logs
2. Test locally first
3. Verify your service URL is correct
4. Ensure your DEP app has the correct BERTopic Service URL in Settings

---

**Ready to deploy?** Choose Railway (recommended) or Render above! 🚀
