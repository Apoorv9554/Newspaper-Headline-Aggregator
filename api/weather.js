export default async function handler(req, res) {
  const { lat, lon, city } = req.query;
  const apiKey = process.env.WEATHER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Weather API key not configured' });
  }

  try {
    let url;
    
    if (lat && lon) {
      // Use coordinates
      url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    } else if (city) {
      // Use city name
      url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;
    } else {
      return res.status(400).json({ error: 'Either lat/lon or city parameter is required' });
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.cod === 401) {
        return res.status(401).json({ error: 'Invalid weather API key' });
      } else if (errorData.cod === 429) {
        return res.status(429).json({ error: 'Weather API rate limit exceeded' });
      } else {
        return res.status(response.status).json({ error: errorData.message || 'Weather API error' });
      }
    }

    const weatherData = await response.json();
    res.status(200).json(weatherData);

  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
} 