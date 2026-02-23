"""
BERTopic Topic Modeling Microservice

A lightweight FastAPI service for topic modeling using BERTopic.
Designed to be deployed on free tiers of Railway, Render, or similar platforms.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

# Import BERTopic and dependencies
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer
import numpy as np

app = FastAPI(
    title="BERTopic Microservice",
    description="Topic modeling service for academic papers",
    version="1.0.0",
)

# Enable CORS for all origins (adjust in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Request/Response Models
# ============================================================

class Paper(BaseModel):
    id: str
    title: str
    abstract: Optional[str] = None

class TopicModelingRequest(BaseModel):
    papers: List[Paper]
    min_topic_size: int = 8
    n_topics: Optional[int] = None
    embedding_model: str = "all-MiniLM-L6-v2"

class TopicInfo(BaseModel):
    topicNumber: int
    count: int
    name: str
    representation: List[str]
    representativeDocs: List[str]
    rarityLabel: str

class PaperWithTopic(BaseModel):
    id: str
    title: str
    abstract: Optional[str] = None
    topicNumber: int
    rarityLabel: str

class TopicModelingResponse(BaseModel):
    topics: List[TopicInfo]
    papers_with_topics: List[PaperWithTopic]
    metadata: dict

# ============================================================
# Topic Modeling Endpoint
# ============================================================

@app.post("/api/topic-modeling", response_model=TopicModelingResponse)
async def model_topics(request: TopicModelingRequest):
    """
    Perform topic modeling on academic papers using BERTopic.

    Args:
        request: TopicModelingRequest with papers and options

    Returns:
        TopicModelingResponse with topics, enriched papers, and metadata
    """
    try:
        import time
        start_time = time.time()

        # Validate input
        if len(request.papers) < request.min_topic_size:
            raise HTTPException(
                status_code=400,
                detail=f"Need at least {request.min_topic_size} papers for topic modeling"
            )

        # Prepare documents
        documents = []
        paper_ids = []

        for paper in request.papers:
            # Combine title and abstract
            text = paper.title
            if paper.abstract:
                text += " " + paper.abstract
            documents.append(text)
            paper_ids.append(paper.id)

        # Initialize embedding model
        embedding_model = SentenceTransformer(request.embedding_model)

        # Initialize BERTopic
        topic_model = BERTopic(
            embedding_model=embedding_model,
            min_topic_size=request.min_topic_size,
            nr_topics=request.n_topics,
            verbose=False,
        )

        # Fit model
        topics, probabilities = topic_model.fit_transform(documents)

        # Get topic info
        topic_info_df = topic_model.get_topic_info()

        # Build TopicInfo list
        topic_info_list = []
        for _, row in topic_info_df.iterrows():
            topic_num = int(row["Topic"])
            count = int(row["Count"])

            # Get topic representation (top keywords)
            if topic_num == -1:
                representation = []
                name = "-1_outliers"
            else:
                topic_words = topic_model.get_topic(topic_num)
                representation = [word for word, _ in topic_words[:10]]
                name = f"{topic_num}_{'_'.join(representation[:4])}"

            # Get representative documents
            representative_docs = []
            if topic_num >= 0:
                topic_indices = [i for i, t in enumerate(topics) if t == topic_num]
                if len(topic_indices) > 0:
                    # Get up to 3 representative docs
                    for idx in topic_indices[:3]:
                        representative_docs.append(request.papers[idx].title)

            # Determine rarity label
            if topic_num == -1:
                rarity_label = "NO_TOPIC"
            elif count >= request.min_topic_size:
                rarity_label = "COMMON"
            else:
                rarity_label = "RARE"

            topic_info_list.append(
                TopicInfo(
                    topicNumber=topic_num,
                    count=count,
                    name=name,
                    representation=representation,
                    representativeDocs=representative_docs,
                    rarityLabel=rarity_label,
                )
            )

        # Build papers with topics
        papers_with_topics = []
        for i, paper in enumerate(request.papers):
            topic_num = int(topics[i])

            # Find rarity label
            topic_entry = next((t for t in topic_info_list if t.topicNumber == topic_num), None)
            rarity_label = topic_entry.rarityLabel if topic_entry else "NO_TOPIC"

            papers_with_topics.append(
                PaperWithTopic(
                    id=paper.id,
                    title=paper.title,
                    abstract=paper.abstract,
                    topicNumber=topic_num,
                    rarityLabel=rarity_label,
                )
            )

        # Build metadata
        n_topics = len([t for t in topic_info_list if t.topicNumber >= 0])
        n_outliers = next((t.count for t in topic_info_list if t.topicNumber == -1), 0)
        processing_time_ms = int((time.time() - start_time) * 1000)

        metadata = {
            "n_topics": n_topics,
            "n_outliers": n_outliers,
            "processing_time_ms": processing_time_ms,
        }

        return TopicModelingResponse(
            topics=topic_info_list,
            papers_with_topics=papers_with_topics,
            metadata=metadata,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Health Check
# ============================================================

@app.get("/health")
async def health_check():
    """Health check endpoint for deployment platforms."""
    return {
        "status": "healthy",
        "service": "bertopic-microservice",
        "version": "1.0.0",
    }

@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "BERTopic Microservice",
        "version": "1.0.0",
        "endpoints": {
            "topic_modeling": "/api/topic-modeling",
            "health": "/health",
        },
    }

# ============================================================
# Run Server
# ============================================================

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
