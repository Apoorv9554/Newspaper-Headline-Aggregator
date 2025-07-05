export default async function handler(req, res) {
  res.status(200).json({ 
    status: 'ok', 
    message: 'News API is running',
    timestamp: new Date().toISOString()
  });
} 