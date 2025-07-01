import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from textblob import TextBlob


try:
    nltk.data.find('sentiment/vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon')

sid = SentimentIntensityAnalyzer()

def analyze_sentiment(text: str) -> dict:
    """Analyze text sentiment using VADER and TextBlob"""
    vader_score = sid.polarity_scores(text)["compound"]  # -1 to 1
    blob_score = TextBlob(text).sentiment.polarity       # -1 to 1
    
    return {
        "vader": vader_score,
        "textblob": blob_score,
        "is_negative": vader_score < -0.5 or blob_score < -0.5,
    }
