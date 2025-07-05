export default async function handler(req, res) {
  const { language } = req.query;
  const apiKey = process.env.NEWS_API_KEY;

  console.log('Digest API called with:', { language, hasApiKey: !!apiKey });

  if (!apiKey) {
    console.error('NEWS_API_KEY not found in environment variables');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Categories for the digest
    const categories = ['general', 'business', 'technology', 'sports'];
    const digest = {};

    // Fetch articles for each category
    for (const category of categories) {
      const params = new URLSearchParams({
        category: category,
        country: 'us',
        apiKey: apiKey,
        language: language || 'en',
        pageSize: '3' // Get 3 articles per category
      });

      const url = `https://newsapi.org/v2/top-headlines?${params.toString()}`;
      console.log(`Fetching ${category} news from:`, url.replace(apiKey, '***'));
      
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        digest[category] = data.articles || [];
        console.log(`Successfully fetched ${data.articles?.length || 0} articles for ${category}`);
      } else {
        const errorData = await response.json();
        console.error(`Failed to fetch ${category} news:`, response.status, errorData);
        digest[category] = [];
      }
    }

    // Add timestamp
    digest.timestamp = new Date().toISOString();

    console.log('Digest response:', { categories: Object.keys(digest), totalArticles: Object.values(digest).flat().length });
    res.status(200).json(digest);

  } catch (error) {
    console.error('Digest error:', error);
    res.status(500).json({ error: 'Failed to fetch digest', details: error.message });
  }
} 