from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from datetime import datetime, timedelta
import json
import os
from dotenv import load_dotenv
from sentiment_analyzer import sentiment_analyzer

app = Flask(__name__)
CORS(app)

@app.route('/api/py/news', methods=['GET'])
def get_news():
    try:
        # Get query parameters
        query = request.args.get('query', '')
        category = request.args.get('category', '')
        source = request.args.get('source', '')
        sentiment = request.args.get('sentiment', '')
        date = request.args.get('date', '')
        
        # Get API key from environment variable
        api_key = os.getenv('NEWS_API_KEY')
        if not api_key:
            return jsonify({'error': 'API key not found'}), 500

        # Build the API URL
        url = f'https://newsapi.org/v2/everything?apiKey={api_key}&language=en&sortBy=publishedAt'
        
        # Add query parameters
        if query:
            url += f'&q={query}'
        if category:
            url += f'&category={category}'
        if source:
            url += f'&sources={source}'
        if date:
            url += f'&from={date}'

        # Make the API request
        response = requests.get(url)
        data = response.json()

        if data.get('status') != 'ok':
            return jsonify({'error': 'Failed to fetch news'}), 500

        # Process and analyze articles
        articles = data.get('articles', [])
        processed_articles = []
        
        for article in articles:
            # Get sentiment using ML model
            sentiment_result = sentiment_analyzer.analyze_sentiment(article.get('title', '') + ' ' + article.get('description', ''))
            
            processed_article = {
                'title': article.get('title', ''),
                'description': article.get('description', ''),
                'url': article.get('url', ''),
                'imageUrl': article.get('urlToImage', ''),
                'source': article.get('source', {}).get('name', ''),
                'publishedAt': article.get('publishedAt', ''),
                'sentiment': sentiment_result['sentiment'],
                'sentimentScore': sentiment_result['score']
            }
            processed_articles.append(processed_article)

        # Filter by sentiment if specified
        if sentiment:
            processed_articles = [article for article in processed_articles if article['sentiment'] == sentiment]

        return jsonify({
            'articles': processed_articles,
            'totalResults': len(processed_articles)
        })

    except Exception as e:
        print(f"Error in get_news: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 