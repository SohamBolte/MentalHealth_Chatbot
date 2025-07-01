from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
from pathlib import Path
from dotenv import load_dotenv
import json
import requests
import logging
from uuid import uuid4
from pydantic import BaseModel

class PHQ9Submission(BaseModel):
    answers: List[int]

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
frontend_path = Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# Load PHQ-9 questions
PHQ9_QUESTIONS = []
try:
    with open(Path(__file__).parent / "assessments/phq9.json") as f:
        PHQ9_QUESTIONS = json.load(f)
except Exception as e:
    logger.error(f"Failed to load PHQ-9 questions: {str(e)}")
    PHQ9_QUESTIONS = [
        {
            "question": "Error loading questions. Please try again later.",
            "options": [],
            "scores": []
        }
    ]

# In-memory conversation store
conversation_store = {}

class Message(BaseModel):
    text: str
    conversation_id: Optional[str] = None

@app.post("/start_conversation")
async def start_conversation():
    """Generates a new conversation ID"""
    conversation_id = str(uuid4())
    conversation_store[conversation_id] = []
    return {"conversation_id": conversation_id}

@app.post("/chat")
async def chat(message: Message):
    """Handle chat messages with conversation memory"""
    try:
        from utils.sentiment import analyze_sentiment
        
        # Initialize or retrieve conversation history
        if not message.conversation_id or message.conversation_id not in conversation_store:
            conversation_id = str(uuid4())
            conversation_store[conversation_id] = []
        else:
            conversation_id = message.conversation_id
        
        conversation_history = conversation_store[conversation_id]
        
        # Analyze sentiment of the current message
        sentiment = analyze_sentiment(message.text)
        
        # Add user message to history
        conversation_history.append({"role": "user", "content": message.text})
        
        # Prepare the prompt with full conversation context
        system_prompt = """<|system|>
Your name is Hope, a compassionate mental health assistant. Rules:
1. Remember the full conversation history
2. Respond empathetically
3. Keep responses concise (1-3 sentences)
4. Never suggest harmful actions
5. If the user seems distressed, suggest professional help
6. Ask follow-up questions when appropriate</|system|>"""
        
        # Format the entire conversation for the model
        prompt = system_prompt + "\n"
        for msg in conversation_history[-6:]:  # Keep last 6 messages for context
            role = "user" if msg["role"] == "user" else "assistant"
            prompt += f"<|{role}|>\n{msg['content']}</|{role}|>\n"
        prompt += "<|assistant|>\n"
        
        # Call Hugging Face API
        response = requests.post(
            "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            json={
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 200,
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "repetition_penalty": 1.1,
                    "do_sample": True,
                    "return_full_text": False
                }
            },
            timeout=45
        )

        if response.status_code != 200:
            error = response.json().get("error", response.text)
            logger.error(f"API error: {error}")
            raise HTTPException(status_code=502, detail="AI service unavailable")

        data = response.json()
        reply = data[0]["generated_text"].strip()
        
        # Clean the response
        for term in ["<|assistant|>", "<|user|>", "<|system|>"]:
            reply = reply.replace(term, "").strip()
        
        if not reply or len(reply.split()) < 3:
            reply = "I want to understand better. Could you tell me more?"
        
        # Add sentiment indicator
        sentiment_icon = "🔴" if sentiment["is_negative"] else "🟢"
        sentiment_text = ("I notice you might be feeling down. I'm here to help." 
                         if sentiment["is_negative"] 
                         else "Glad to hear you're doing well!")
        
        full_reply = f"{reply}\n\n{sentiment_icon} {sentiment_text}"
        
        # Add assistant's reply to conversation history
        conversation_history.append({"role": "assistant", "content": full_reply})
        
        return {
            "response": full_reply,
            "sentiment": sentiment,
            "conversation_id": conversation_id
        }

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Response timed out")
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/phq9/start")
def start_phq9():
    """Return PHQ-9 questions"""
    return {"questions": PHQ9_QUESTIONS}

@app.post("/phq9/submit")
def submit_phq9(submission: PHQ9Submission):
    """Calculate PHQ-9 score with guaranteed response structure"""
    answers = submission.answers  # Get answers from the validated model
    
    try:
        if len(answers) != 9:
            raise HTTPException(
                status_code=400,
                detail=f"Expected 9 answers, got {len(answers)}"
            )
        
        if any(a not in (0, 1, 2, 3) for a in answers):
            raise HTTPException(
                status_code=400,
                detail="All answers must be between 0-3"
            )
        
        total = sum(answers)
        severity = (
            "minimal" if total < 5 else
            "mild" if total < 10 else
            "moderate" if total < 15 else
            "severe"
        )
        
        return {
            "score": total,
            "severity": severity,
            "recommendation": (
                "Consider speaking with a mental health professional" 
                if total >= 10 else 
                "Your results suggest minimal symptoms"
            )
        }
        
    except Exception as e:
        logger.error(f"PHQ-9 error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing assessment")
    
@app.get("/emergency")
def get_emergency_resources(country: str = "US"):
    """Return crisis hotlines"""
    resources = {
        "US": {"hotline": "1-800-273-8255", "text": "Text HOME to 741741"},
        "UK": {"hotline": "116 123"},
        "IN": {"hotline": "9152987821"},
    }
    return resources.get(country.upper(), resources["US"])

@app.get("/")
async def serve_index():
    return FileResponse(frontend_path / "index.html")