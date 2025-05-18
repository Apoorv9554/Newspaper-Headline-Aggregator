from transformers import pipeline
import numpy as np

class SentimentAnalyzer:
    def __init__(self):
        # Initialize the sentiment analysis pipeline with a pre-trained model
        self.analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
    
    def analyze_sentiment(self, text):
        """
        Analyze the sentiment of a given text
        Returns: dict with sentiment and score
        """
        try:
            # Get sentiment analysis result
            result = self.analyzer(text)[0]
            
            # Map the label to our sentiment categories
            label = result['label'].lower()
            score = result['score']
            
            # Convert to our sentiment categories
            if label == 'positive':
                if score > 0.8:
                    return {'sentiment': 'very_positive', 'score': score}
                else:
                    return {'sentiment': 'positive', 'score': score}
            else:  # negative
                if score > 0.8:
                    return {'sentiment': 'very_negative', 'score': score}
                else:
                    return {'sentiment': 'negative', 'score': score}
                    
        except Exception as e:
            print(f"Error in sentiment analysis: {str(e)}")
            return {'sentiment': 'neutral', 'score': 0.5}

# Create a singleton instance
sentiment_analyzer = SentimentAnalyzer() 