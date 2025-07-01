const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const natural = require('natural');
require('dotenv').config();

// API Configuration
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';
const GNEWS_API_BASE_URL = 'https://gnews.io/api/v4';

// Rate limiting configuration
const GNEWS_RATE_LIMIT = {
    maxRequests: 5,    // Reduced from 10 to 5 requests per window
    windowMs: 60000,   // 1 minute window
    currentRequests: 0,
    lastReset: Date.now(),
    cooldownPeriod: 60000  // 1 minute cooldown after 429
};

// Validate API keys
if (!NEWS_API_KEY || !GNEWS_API_KEY) {
    console.error('Error: Missing API keys. Please check your .env file.');
    console.error('Required environment variables:');
    console.error('- NEWS_API_KEY');
    console.error('- GNEWS_API_KEY');
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

// Debug: Log environment variables
console.log('Environment Variables:');
console.log('PORT:', process.env.PORT);
console.log('NEWS_API_KEY:', NEWS_API_KEY ? 'Present' : 'Missing');
console.log('GNEWS_API_KEY:', GNEWS_API_KEY ? 'Present' : 'Missing');

// Initialize cache with 30 minutes TTL (increased from 15 minutes)
const cache = new NodeCache({ stdTTL: 1800 });

// Initialize sentiment analyzer
const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Debug: Log API configuration
console.log('API Configuration:');
console.log('NEWS_API_BASE_URL:', NEWS_API_BASE_URL);
console.log('GNEWS_API_BASE_URL:', GNEWS_API_BASE_URL);

// Utility Functions
const analyzeSentiment = (text) => {
    const tokens = new natural.WordTokenizer().tokenize(text);
    const score = analyzer.getSentiment(tokens);
    
    // Updated sentiment thresholds for more granular analysis
    if (score > 0.5) return { score, label: 'very_positive', emoji: '😊' };
    if (score > 0.2) return { score, label: 'positive', emoji: '🙂' };
    if (score < -0.5) return { score, label: 'very_negative', emoji: '😢' };
    if (score < -0.2) return { score, label: 'negative', emoji: '😕' };
    return { score, label: 'neutral', emoji: '😐' };
};

const generateDigest = (articles) => {
    try {
        // Ensure articles is an array and has items
        if (!Array.isArray(articles)) {
            console.error('Invalid articles data:', articles);
            return [];
        }

        if (articles.length === 0) {
            console.log('No articles available for digest');
            return [];
        }

        // Simple digest generation - in a real app, you'd use a more sophisticated approach
        const topStories = articles.slice(0, 5).map(article => ({
            title: article.title || 'No title available',
            summary: article.description ? article.description.substring(0, 100) + '...' : 'No description available',
            category: article.category || 'general',
            url: article.url || '#',
            publishedAt: article.publishedAt || new Date().toISOString()
        }));

        return topStories;
    } catch (error) {
        console.error('Error generating digest:', error);
        return [];
    }
};

// Add rate limiting check function
const checkGNewsRateLimit = () => {
    const now = Date.now();
    if (now - GNEWS_RATE_LIMIT.lastReset >= GNEWS_RATE_LIMIT.windowMs) {
        GNEWS_RATE_LIMIT.currentRequests = 0;
        GNEWS_RATE_LIMIT.lastReset = now;
    }
    
    if (GNEWS_RATE_LIMIT.currentRequests >= GNEWS_RATE_LIMIT.maxRequests) {
        const waitTime = GNEWS_RATE_LIMIT.windowMs - (now - GNEWS_RATE_LIMIT.lastReset);
        throw new Error(`GNews API rate limit exceeded. Please try again in ${Math.ceil(waitTime/1000)} seconds.`);
    }
    
    GNEWS_RATE_LIMIT.currentRequests++;
};

// Add retry logic for GNews API calls
const fetchFromGNews = async (endpoint, params, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            checkGNewsRateLimit();
            const response = await axios.get(`${GNEWS_API_BASE_URL}/${endpoint}`, {
                params: {
                    ...params,
                    apikey: GNEWS_API_KEY
                }
            });
            
            if (response.data.errors) {
                throw new Error(response.data.errors[0] || 'GNews error');
            }
            
            return response;
        } catch (error) {
            // Handle 429 status code specifically
            if (error.response?.status === 429) {
                console.log('GNews API rate limit hit (429). Entering cooldown period...');
                // Reset the rate limit counter and wait for cooldown period
                GNEWS_RATE_LIMIT.currentRequests = GNEWS_RATE_LIMIT.maxRequests;
                GNEWS_RATE_LIMIT.lastReset = Date.now();
                
                if (attempt < retries) {
                    const waitTime = GNEWS_RATE_LIMIT.cooldownPeriod;
                    console.log(`Waiting ${waitTime/1000} seconds before retry ${attempt}/${retries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }
            
            // Handle other rate limit errors
            if (error.message.includes('rate limit') && attempt < retries) {
                const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`GNews rate limit hit. Waiting ${waitTime}ms before retry ${attempt}/${retries}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            
            throw error;
        }
    }
};

// Add cache fallback function
const getCachedOrFallback = async (cacheKey, fetchFunction, fallbackMessage) => {
    try {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            console.log(`Using cached data for ${cacheKey}`);
            return {
                ...cachedData,
                _cached: true,
                _message: 'Using cached data'
            };
        }

        const freshData = await fetchFunction();
        cache.set(cacheKey, freshData);
        return freshData;
    } catch (error) {
        console.error(`Error fetching fresh data for ${cacheKey}:`, error.message);
        
        // Try to get cached data even if it's expired
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            console.log(`Using expired cached data for ${cacheKey} due to error`);
            return {
                ...cachedData,
                _cached: true,
                _message: fallbackMessage || 'Using cached data due to API error'
            };
        }
        
        throw error;
    }
};

// Add API key validation function
const validateApiKeys = () => {
    if (!NEWS_API_KEY || NEWS_API_KEY === 'your_news_api_key_here') {
        console.error('Error: Invalid or missing NEWS_API_KEY');
        return false;
    }
    if (!GNEWS_API_KEY || GNEWS_API_KEY === 'your_gnews_api_key_here') {
        console.error('Error: Invalid or missing GNEWS_API_KEY');
        return false;
    }
    return true;
};

// Update mergeNewsSources function
const mergeNewsSources = async (category, language = 'en') => {
    const cacheKey = `news_${category}_${language}`;
    
    return getCachedOrFallback(
        cacheKey,
        async () => {
            try {
                let allArticles = [];
                let sourcesUsed = [];
                let errors = [];
                
                // Try to get cached data first
                const cachedData = cache.get(cacheKey);
                if (cachedData) {
                    console.log(`Using cached data for ${cacheKey}`);
                    return cachedData;
                }
                
                // Fetch from NewsAPI
                try {
                    console.log('Fetching from NewsAPI...');
                    const newsApiResponse = await axios.get(`${NEWS_API_BASE_URL}/top-headlines`, {
                        params: {
                            country: language === 'hi' ? 'in' : 'us',
                            category: category,
                            language: language,
                            apiKey: NEWS_API_KEY
                        }
                    });
                    
                    if (newsApiResponse.data.status === 'error') {
                        throw new Error(newsApiResponse.data.message || 'NewsAPI error');
                    }
                    
                    if (newsApiResponse.data.articles && newsApiResponse.data.articles.length > 0) {
                        // Process NewsAPI articles
                        const processedArticles = newsApiResponse.data.articles.map(article => ({
                            ...article,
                            urlToImage: article.urlToImage && article.urlToImage.startsWith('http') ? article.urlToImage : null,
                            source: {
                                name: article.source?.name || 'Unknown Source'
                            }
                        }));
                        allArticles = [...allArticles, ...processedArticles];
                        sourcesUsed.push('NewsAPI');
                        console.log(`Successfully fetched ${processedArticles.length} articles from NewsAPI`);
                    }
                } catch (newsApiError) {
                    console.error('NewsAPI Error Details:', {
                        message: newsApiError.message,
                        response: newsApiError.response?.data,
                        status: newsApiError.response?.status
                    });
                    errors.push(`NewsAPI: ${newsApiError.message}`);
                }

                // Fetch from GNews with retry logic
                try {
                    console.log('Fetching from GNews...');
                    const gnewsResponse = await fetchFromGNews('top-headlines', {
                        category: category,
                        lang: language,
                        max: 10
                    });
                    
                    if (gnewsResponse.data.articles && gnewsResponse.data.articles.length > 0) {
                        // Process GNews articles
                        const processedArticles = gnewsResponse.data.articles.map(article => ({
                            ...article,
                            urlToImage: article.image && article.image.startsWith('http') ? article.image : null,
                            source: {
                                name: article.source?.name || 'Unknown Source'
                            }
                        }));
                        allArticles = [...allArticles, ...processedArticles];
                        sourcesUsed.push('GNews');
                        console.log(`Successfully fetched ${processedArticles.length} articles from GNews`);
                    }
                } catch (gnewsError) {
                    console.error('GNews Error Details:', {
                        message: gnewsError.message,
                        response: gnewsError.response?.data,
                        status: gnewsError.response?.status
                    });
                    errors.push(`GNews: ${gnewsError.message}`);
                }

                if (allArticles.length === 0) {
                    if (cachedData) {
                        console.log('No fresh articles, using cached data');
                        return {
                            ...cachedData,
                            _cached: true,
                            _message: 'Using cached data due to no fresh articles'
                        };
                    }
                    throw new Error(`No articles fetched. Errors: ${errors.join('; ')}`);
                }

                // Remove duplicates based on title
                const uniqueArticles = Array.from(new Map(
                    allArticles.map(article => [article.title, article])
                ).values());

                // Add sentiment analysis and ensure image URLs are valid
                const articlesWithSentiment = uniqueArticles.map(article => ({
                    ...article,
                    sentiment: analyzeSentiment(article.title + ' ' + (article.description || '')),
                    language: language,
                    urlToImage: article.urlToImage && article.urlToImage.startsWith('http') ? article.urlToImage : null
                }));

                // Cache the results
                const result = {
                    articles: articlesWithSentiment,
                    sources: sourcesUsed,
                    timestamp: new Date().toISOString()
                };
                cache.set(cacheKey, result);
                
                return result;
            } catch (error) {
                console.error('Error in mergeNewsSources:', error);
                throw error;
            }
        },
        'Using cached news data due to API rate limits'
    );
};

// Routes
app.get('/api/news', async (req, res) => {
    try {
        console.log('Received news request:', {
            query: req.query,
            headers: req.headers,
            timestamp: new Date().toISOString()
        });

        // Validate API keys first
        if (!validateApiKeys()) {
            console.error('API key validation failed');
            return res.status(500).json({
                error: 'API Configuration Error',
                message: 'Invalid or missing API keys. Please check your configuration.'
            });
        }

        const { category = 'general', source, sentiment, language = 'en' } = req.query;
        console.log('Processing request for:', { category, source, sentiment, language });
        
        // Validate category
        const validCategories = ['general', 'business', 'technology', 'sports', 'entertainment', 'health', 'science'];
        if (!validCategories.includes(category)) {
            console.error('Invalid category:', category);
            return res.status(400).json({
                error: 'Invalid category',
                message: `Category must be one of: ${validCategories.join(', ')}`
            });
        }

        // Validate language
        const validLanguages = ['en', 'hi'];
        if (!validLanguages.includes(language)) {
            console.error('Invalid language:', language);
            return res.status(400).json({
                error: 'Invalid language',
                message: `Language must be one of: ${validLanguages.join(', ')}`
            });
        }
        
        console.log('Fetching news from merged sources...');
        const newsData = await mergeNewsSources(category, language);
        
        if (!newsData || !newsData.articles || !Array.isArray(newsData.articles) || newsData.articles.length === 0) {
            console.error('No articles found for:', { category, language });
            return res.status(404).json({
                error: 'No articles found',
                message: 'No news articles available for the requested category and language'
            });
        }
        
        // Apply filters if provided
        let filteredArticles = newsData.articles;
        
        if (source) {
            filteredArticles = filteredArticles.filter(article => 
                article.source?.name?.toLowerCase() === source.toLowerCase()
            );
        }
        
        if (sentiment) {
            filteredArticles = filteredArticles.filter(article => 
                article.sentiment?.label === sentiment
            );
        }
        
        console.log(`Returning ${filteredArticles.length} articles for category: ${category}, language: ${language}`);
        res.json({ 
            articles: filteredArticles,
            category: category,
            language: language,
            total: filteredArticles.length,
            sources: newsData.sources || [],
            timestamp: newsData.timestamp || new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in /api/news endpoint:', {
            error: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status
        });
        res.status(500).json({
            error: 'Failed to fetch news',
            message: error.message,
            details: error.response?.data || 'No additional details available'
        });
    }
});

app.get('/api/news/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const articles = await mergeNewsSources(category);
        const digest = generateDigest(articles);
        
        const response = {
            articles,
            digest,
            timestamp: new Date().toISOString(),
            _cached: articles._cached || false,
            _message: articles._message
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching category news:', error);
        res.status(500).json({ error: 'Failed to fetch category news' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q, source, sentiment } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const cacheKey = `search_${q}_${source || ''}_${sentiment || ''}`;
        const cachedResults = cache.get(cacheKey);
        
        if (cachedResults) {
            return res.json(cachedResults);
        }

        let articles = [];
        let errors = [];

        // Search NewsAPI
        try {
            const newsApiResponse = await axios.get(`${NEWS_API_BASE_URL}/everything`, {
                params: {
                    q: q,
                    language: 'en',
                    sortBy: 'publishedAt',
                    apiKey: NEWS_API_KEY
                }
            });

            if (newsApiResponse.data.status === 'error') {
                throw new Error(newsApiResponse.data.message || 'NewsAPI error');
            }

            articles = [...articles, ...newsApiResponse.data.articles];
        } catch (newsApiError) {
            console.error('NewsAPI Error:', newsApiError.message);
            errors.push(`NewsAPI: ${newsApiError.message}`);
        }

        // Search GNews
        try {
            const gnewsResponse = await fetchFromGNews('search', {
                q: q,
                lang: 'en',
                max: 10
            });

            articles = [...articles, ...gnewsResponse.data.articles];
        } catch (gnewsError) {
            console.error('GNews Error:', gnewsError.message);
            errors.push(`GNews: ${gnewsError.message}`);
        }

        if (articles.length === 0) {
            return res.status(404).json({ 
                error: 'No articles found',
                details: errors.length > 0 ? errors.join('; ') : null
            });
        }

        // Remove duplicates based on title
        articles = Array.from(new Map(
            articles.map(article => [article.title, article])
        ).values());

        // Apply filters
        if (source) {
            articles = articles.filter(article => 
                article.source?.name?.toLowerCase().includes(source.toLowerCase())
            );
        }

        // Add sentiment analysis
        articles = articles.map(article => ({
            ...article,
            sentiment: analyzeSentiment(article.title + ' ' + (article.description || ''))
        }));

        if (sentiment) {
            articles = articles.filter(article => 
                article.sentiment.label === sentiment
            );
        }

        const response = {
            articles,
            timestamp: new Date().toISOString()
        };

        cache.set(cacheKey, response);
        res.json(response);
    } catch (error) {
        console.error('Error searching news:', error);
        res.status(500).json({ 
            error: 'Failed to search news',
            details: error.message
        });
    }
});

app.get('/api/digest', async (req, res) => {
    try {
        const cachedDigest = cache.get('daily_digest');
        if (cachedDigest) {
            return res.json(cachedDigest);
        }

        const categories = ['general', 'business', 'technology', 'sports'];
        const allArticles = await Promise.all(
            categories.map(category => mergeNewsSources(category))
        );

        const digest = {
            general: generateDigest(allArticles[0]?.articles || []),
            business: generateDigest(allArticles[1]?.articles || []),
            technology: generateDigest(allArticles[2]?.articles || []),
            sports: generateDigest(allArticles[3]?.articles || []),
            timestamp: new Date().toISOString()
        };

        cache.set('daily_digest', digest);
        res.json(digest);
    } catch (error) {
        console.error('Error generating digest:', error);
        res.status(500).json({ 
            error: 'Failed to generate digest',
            message: error.message
        });
    }
});

// Add health check endpoint
app.get('/api/health', (req, res) => {
    try {
        console.log('Health check request received');
        const healthStatus = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            apiKeys: {
                newsApi: NEWS_API_KEY ? 'Present' : 'Missing',
                gnewsApi: GNEWS_API_KEY ? 'Present' : 'Missing'
            }
        };
        console.log('Health check response:', healthStatus);
        res.status(200).json(healthStatus);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start server with error handling
const startServer = () => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
};

startServer();

module.exports = app; 