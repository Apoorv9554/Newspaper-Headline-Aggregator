# Newspaper Headline Aggregator

A modern, full-stack news aggregator application that brings you the latest headlines from multiple sources with advanced features like sentiment analysis, offline support, and personalized news delivery.

## 🌟 Features

### Core Features
- **Multi-Source News Aggregation**: Fetch and display news from multiple APIs (NewsAPI.org, GNews)
- **Category-Based Browsing**: Filter news by categories (Politics, Business, Sports, Technology, etc.)
- **Advanced Search & Filters**: Search by keywords, filter by source, date, and sentiment
- **Responsive Design**: Beautiful UI that works on all devices

### Unique Features
- **Sentiment Analysis**: Color-coded sentiment indicators for each article
- **Dark Mode**: Toggle between light and dark themes
- **Offline Support**: Access cached articles when offline (PWA)
- **Live News Ticker**: Real-time updates of breaking news
- **Daily Digest**: Auto-generated summary of top stories
- **Read Later List**: Save articles for later reading
- **Personalization**: Remember user preferences without signup
- **Weather Widget**: Local weather information
- **Newsletter Subscription**: Get daily news digest in your inbox

## 🛠️ Tech Stack

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Progressive Web App (PWA) support
- Service Workers for offline functionality
- IndexedDB for local storage
- Responsive design with CSS Grid and Flexbox

### Backend
- Node.js with Express.js
- Natural language processing for sentiment analysis
- Caching with Node-Cache
- RESTful API endpoints

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- API keys for NewsAPI.org and GNews

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/newspaper-headline-aggregator.git
cd newspaper-headline-aggregator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
PORT=3000
NEWS_API_KEY=your_newsapi_key
GNEWS_API_KEY=your_gnews_key
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

## 📁 Project Structure

```
newspaper-headline-aggregator/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── sw.js
│   ├── manifest.json
│   ├── offline.html
│   └── icons/
├── server.js
├── package.json
└── README.md
```

## 🔧 API Endpoints

- `GET /api/news`: Get all news articles
- `GET /api/news/:category`: Get news by category
- `GET /api/search`: Search news with filters
- `GET /api/digest`: Get daily news digest
- `POST /api/newsletter`: Subscribe to newsletter

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Opera (latest)

## 📱 PWA Features

- Offline support
- Add to home screen
- Push notifications
- Background sync
- Responsive design

## 🔒 Security

- API keys stored in environment variables
- CORS enabled
- Rate limiting
- Input sanitization
- XSS protection

## 🧪 Testing

Run tests with:
```bash
npm test
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Contact

Your Name - [@yourtwitter](https://twitter.com/yourtwitter)
Project Link: [https://github.com/yourusername/newspaper-headline-aggregator](https://github.com/yourusername/newspaper-headline-aggregator)
