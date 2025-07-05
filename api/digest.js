export default async function handler(req, res) {
  const { language } = req.query;
  const apiKey = process.env.NEWS_API_KEY;

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
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        digest[category] = data.articles || [];
      } else {
        console.error(`Failed to fetch ${category} news:`, response.status);
        digest[category] = [];
      }
    }

    // Add timestamp
    digest.timestamp = new Date().toISOString();

    res.status(200).json(digest);

  } catch (error) {
    console.error('Digest error:', error);
    res.status(500).json({ error: 'Failed to fetch digest' });
  }
} 