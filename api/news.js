export default async function handler(req, res) {
  const { category, language } = req.query;
  const apiKey = process.env.NEWS_API_KEY;

  try {
    // Build the News API URL with parameters
    const params = new URLSearchParams({
      country: 'us',
      apiKey: apiKey,
      language: language || 'en'
    });

    // Add category if specified
    if (category && category !== 'general') {
      params.append('category', category);
    }

    const url = `https://newsapi.org/v2/top-headlines?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch news' });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('News API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 