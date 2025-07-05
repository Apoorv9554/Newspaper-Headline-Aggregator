export default async function handler(req, res) {
  const { q, language, source, date, sentiment } = req.query;
  const apiKey = process.env.NEWS_API_KEY;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    // Build the News API URL with search parameters
    const params = new URLSearchParams({
      q: q,
      apiKey: apiKey,
      language: language || 'en',
      sortBy: 'publishedAt'
    });

    // Add optional filters
    if (source) params.append('domains', source);
    if (date) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(date));
      params.append('from', fromDate.toISOString().split('T')[0]);
    }

    const url = `https://newsapi.org/v2/everything?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`News API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter by sentiment if specified (this would require sentiment analysis)
    let articles = data.articles || [];
    if (sentiment) {
      // For now, we'll just return all articles
      // In a real implementation, you'd analyze sentiment here
      console.log('Sentiment filter requested:', sentiment);
    }

    res.status(200).json({
      articles: articles.slice(0, 20), // Limit to 20 articles
      totalResults: data.totalResults
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search news' });
  }
} 