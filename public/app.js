// State Management
const state = {
    currentCategory: 'general',
    viewType: localStorage.getItem('viewType') || 'grid',
    theme: localStorage.getItem('theme') || 'light',
    language: localStorage.getItem('language') || 'en',
    readLater: JSON.parse(localStorage.getItem('readLater')) || [],
    preferences: JSON.parse(localStorage.getItem('preferences')) || {
        sources: [],
        categories: ['general', 'business', 'technology', 'sports'],
        showOnlyInterests: false
    },
    isLoading: false,
    lastScrollPosition: 0,
    scrollTimeout: null,
    currentFilters: {
        source: '',
        sentiment: ''
    },
    searchQuery: '',
    eventListenersInitialized: false
};

// Initialize theme immediately
(function() {
    try {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        state.theme = savedTheme;
        
        // Update meta theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', savedTheme === 'light' ? '#ffffff' : '#111827');
        }

        // Update theme toggle icon if it exists
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    } catch (error) {
        console.error('Error initializing theme:', error);
    }
})();

// DOM Elements
const elements = {
    newsGrid: document.getElementById('newsGrid'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    sourceFilter: document.getElementById('sourceFilter'),
    categoryFilter: document.getElementById('categoryFilter'),
    sentimentFilter: document.getElementById('sentimentFilter'),
    themeToggle: document.getElementById('themeToggle'),
    viewToggle: document.getElementById('viewToggle'),
    tickerContent: document.querySelector('.ticker-content'),
    digestContent: document.querySelector('.digest-content'),
    trendingContent: document.querySelector('.trending-content'),
    readLaterContent: document.querySelector('.read-later-content'),
    weatherContent: document.querySelector('.weather-content'),
    newsletterForm: document.getElementById('newsletterForm')
};

// Get category links
const categoryLinks = document.querySelectorAll('[data-category]');

// Variables for scroll handling
let searchTimeout;

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

// Add weather API configuration
const WEATHER_API_KEY = 'be3ad0f624d26ec12d7ebae30e4d68e5'; // You'll need to get this from OpenWeatherMap
const WEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Utility Functions
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const getSentimentEmoji = (sentiment) => {
    const emojis = {
        'very_positive': '😊',
        'positive': '🙂',
        'neutral': '😐',
        'negative': '😕',
        'very_negative': '😢'
    };
    return sentiment?.emoji || emojis[sentiment?.label] || '😐';
};

const getSentimentColor = (sentiment) => {
    switch (sentiment?.label) {
        case 'very_positive': return '#2E7D32'; // Dark Green
        case 'positive': return '#4CAF50';     // Green
        case 'negative': return '#F44336';     // Red
        case 'very_negative': return '#C62828'; // Dark Red
        default: return '#9E9E9E';             // Grey
    }
};

// Optimize scroll handling
const handleScroll = () => {
    if (state.scrollTimeout) {
        window.cancelAnimationFrame(state.scrollTimeout);
    }

    state.scrollTimeout = window.requestAnimationFrame(() => {
        const currentScroll = window.pageYOffset;
        const navbar = document.querySelector('.navbar');
        
        if (currentScroll > state.lastScrollPosition && currentScroll > 100) {
            navbar.classList.add('hidden');
        } else {
            navbar.classList.remove('hidden');
        }
        
        state.lastScrollPosition = currentScroll;
    });
};

// Optimize image loading
const createNewsCard = (article, index) => {
    const delay = index * 100;
    const isListView = state.viewType === 'list';
    
    return `
        <article class="news-card ${isListView ? 'news-card-list' : ''}" style="animation-delay: ${delay}ms">
            <div class="${isListView ? 'flex' : ''}">
                <div class="${isListView ? 'w-1/3' : ''} relative">
                    <div class="image-container" style="aspect-ratio: 16/9;">
                        <img src="${article.urlToImage || '/fallback.svg'}" 
                             alt="${article.title}"
                             loading="lazy"
                             class="h-full object-cover news-image"
                             data-src="${article.urlToImage || '/fallback.svg'}"
                             onerror="this.onerror=null; this.src='/fallback.svg';"
                             style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div class="absolute top-2 right-2">
                        <button class="share-btn bg-white p-2 rounded-full shadow hover:bg-blue-50 transition-colors">
                            <i class="fas fa-share-alt text-gray-600"></i>
                        </button>
                    </div>
                </div>
                <div class="w-2/3 p-4">
                    <div class="flex items-center mb-2">
                        <span class="text-sm text-gray-500">${article.source?.name || 'Unknown Source'}</span>
                        <span class="mx-2 text-gray-300">•</span>
                        <span class="text-sm text-gray-500">${formatDate(article.publishedAt)}</span>
                    </div>
                    <h2 class="text-xl font-bold mb-2 line-clamp-2">${article.title}</h2>
                    <p class="text-gray-600 mb-4 line-clamp-3">${article.description || 'No description available'}</p>
                    <div class="flex justify-between items-center">
                        <div class="flex space-x-2">
                            <button class="like-btn text-gray-400 hover:text-red-500 transition-colors">
                                <i class="far fa-heart"></i>
                            </button>
                            <button class="bookmark-btn text-gray-400 hover:text-blue-500 transition-colors">
                                <i class="far fa-bookmark"></i>
                            </button>
                        </div>
                        <a href="${article.url}" target="_blank" 
                           class="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition-all transform hover:scale-105">
                            Read More
                        </a>
                    </div>
                </div>
            </div>
        </article>
    `;
};

const createTrendingItem = (article, index) => {
    const delay = index * 100;
    const sentimentClass = article.sentiment ? `sentiment-${article.sentiment}` : '';
    return `
        <div class="trending-item ${sentimentClass}" style="animation-delay: ${delay}ms">
            <div class="trending-rank">${index + 1}</div>
            <div class="trending-content">
                <h4 class="trending-title">${article.title}</h4>
                <div class="trending-meta">
                    <span class="trending-source">${article.source}</span>
                    <span class="trending-time">${formatDate(article.publishedAt)}</span>
                </div>
            </div>
        </div>
    `;
};

const showLoading = (container) => {
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading news articles...</p>
        </div>
    `;
};

const showError = (container, message) => {
    container.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error Loading News</h3>
            <p>${message}</p>
            <button onclick="retryFetch()" class="retry-button">
                <i class="fas fa-sync-alt"></i> Retry
            </button>
        </div>
    `;
};

// Optimize lazy loading with better error handling
const lazyLoadImages = () => {
    try {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    
                    if (!src) {
                        console.warn('No data-src attribute found for image:', img);
                        img.src = '/fallback.svg';
                        observer.unobserve(img);
                        return;
                    }
                    
                    // Add cache-busting parameter
                    const cacheBuster = new Date().getTime();
                    const srcWithCacheBuster = `${src}${src.includes('?') ? '&' : '?'}_cb=${cacheBuster}`;
                    
                    // Create a new image to test loading
                    const tempImage = new Image();
                    tempImage.onload = () => {
                        img.src = srcWithCacheBuster;
                        img.classList.add('loaded');
                        img.classList.remove('loading');
                    };
                    tempImage.onerror = () => {
                        console.warn('Failed to load image:', src);
                        img.src = '/fallback.svg';
                        img.classList.add('error');
                        img.classList.remove('loading');
                    };
                    tempImage.src = srcWithCacheBuster;
                    
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.1
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            img.classList.add('loading');
            imageObserver.observe(img);
        });
    } catch (error) {
        console.error('Error in lazy loading:', error);
    }
};

// Update weather widget function with better error handling and location accuracy
const updateWeatherWidget = async () => {
    try {
        // Get current location with timeout and high accuracy
        const position = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Location request timed out'));
            }, 10000);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    clearTimeout(timeoutId);
                    resolve(pos);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    reject(new Error(`Location error: ${error.message}`));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });

        const { latitude, longitude } = position.coords;
        console.log('Location coordinates:', { latitude, longitude });

        // Fetch weather data with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
            `${API_BASE_URL}/weather?lat=${latitude}&lon=${longitude}`,
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json();
            if (errorData.cod === 401) {
                throw new Error('Invalid API key. Please check your OpenWeatherMap API key.');
            } else if (errorData.cod === 429) {
                throw new Error('API rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`Weather API error: ${errorData.message || response.statusText}`);
            }
        }

        const weatherData = await response.json();
        
        // Validate weather data
        if (!weatherData.weather?.[0]?.icon || !weatherData.main?.temp) {
            throw new Error('Invalid weather data received from API');
        }
        
        // Get weather icon code
        const iconCode = weatherData.weather[0].icon;
        const weatherIcon = getWeatherEmoji(iconCode);
        
        // Format temperature
        const temp = Math.round(weatherData.main.temp);
        const location = weatherData.name;
        const condition = weatherData.weather[0].description;

        // Log weather data for debugging
        console.log('Weather data:', {
            location,
            temperature: temp,
            condition,
            coordinates: { latitude, longitude }
        });

        elements.weatherContent.innerHTML = `
            <div class="weather-widget">
                <div class="text-4xl mb-2">${weatherIcon}</div>
                <p class="text-2xl font-bold">${temp}°C</p>
                <p class="text-gray-600 capitalize">${condition}</p>
                <p class="text-sm text-gray-500">${location}</p>
                <div class="weather-details mt-2 text-sm">
                    <p>Humidity: ${weatherData.main.humidity}%</p>
                    <p>Wind: ${Math.round(weatherData.wind.speed)} m/s</p>
                </div>
                <button onclick="updateWeatherWidget()" class="refresh-btn mt-2 text-sm text-blue-500 hover:text-blue-600">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
        `;

    } catch (error) {
        console.error('Error fetching weather:', error);
        elements.weatherContent.innerHTML = `
            <div class="weather-widget error">
                <i class="fas fa-exclamation-circle text-red-500 mb-2"></i>
                <p class="text-red-500">${error.message}</p>
                <button onclick="updateWeatherWidget()" class="retry-button mt-2">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
};

// Add function to manually set location
const setManualLocation = async (city = 'Greater Noida') => {
    try {
        // Fetch coordinates for Greater Noida
        const response = await fetch(
            `${API_BASE_URL}/weather?city=${city}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch weather data');
        }

        const weatherData = await response.json();
        
        // Get weather icon code
        const iconCode = weatherData.weather[0].icon;
        const weatherIcon = getWeatherEmoji(iconCode);
        
        // Format temperature
        const temp = Math.round(weatherData.main.temp);
        const location = weatherData.name;
        const condition = weatherData.weather[0].description;

        elements.weatherContent.innerHTML = `
            <div class="weather-widget">
                <div class="text-4xl mb-2">${weatherIcon}</div>
                <p class="text-2xl font-bold">${temp}°C</p>
                <p class="text-gray-600 capitalize">${condition}</p>
                <p class="text-sm text-gray-500">${location}</p>
                <div class="weather-details mt-2 text-sm">
                    <p>Humidity: ${weatherData.main.humidity}%</p>
                    <p>Wind: ${Math.round(weatherData.wind.speed)} m/s</p>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error fetching weather for manual location:', error);
        elements.weatherContent.innerHTML = `
            <div class="weather-widget error">
                <i class="fas fa-exclamation-circle text-red-500 mb-2"></i>
                <p class="text-red-500">${error.message}</p>
                <button onclick="setManualLocation()" class="retry-button mt-2">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
};

// Test weather API key
const testWeatherAPI = async () => {
    try {
        // Test coordinates (New York City)
        const testLat = 40.7128;
        const testLon = -74.0060;
        
        const response = await fetch(
            `${API_BASE_URL}/weather?lat=${testLat}&lon=${testLon}`
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Weather API test failed:', errorData);
            return false;
        }
        
        const data = await response.json();
        console.log('Weather API test successful:', data);
        return true;
    } catch (error) {
        console.error('Weather API test error:', error);
        return false;
    }
};

// Helper function to convert weather icon codes to emojis
const getWeatherEmoji = (iconCode) => {
    const emojiMap = {
        '01d': '☀️', // clear sky day
        '01n': '🌙', // clear sky night
        '02d': '⛅', // few clouds day
        '02n': '☁️', // few clouds night
        '03d': '☁️', // scattered clouds
        '03n': '☁️',
        '04d': '☁️', // broken clouds
        '04n': '☁️',
        '09d': '🌧️', // shower rain
        '09n': '🌧️',
        '10d': '🌦️', // rain day
        '10n': '🌧️', // rain night
        '11d': '⛈️', // thunderstorm
        '11n': '⛈️',
        '13d': '🌨️', // snow
        '13n': '🌨️',
        '50d': '🌫️', // mist
        '50n': '🌫️'
    };
    return emojiMap[iconCode] || '🌡️';
};

// Add server status check function with retry mechanism
const checkServerStatus = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`${API_BASE_URL}/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                return true;
            }
        } catch (error) {
            console.warn(`Server check attempt ${i + 1} failed:`, error);
            if (i === retries - 1) {
                console.error('Server is not responding after multiple attempts');
                return false;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return false;
};

// Add language toggle function
const toggleLanguage = () => {
    state.language = state.language === 'en' ? 'hi' : 'en';
    localStorage.setItem('language', state.language);
    
    // Update language toggle button
    const langToggle = document.getElementById('languageToggle');
    if (langToggle) {
        langToggle.innerHTML = state.language === 'en' ? 'हिंदी' : 'English';
    }
    
    // Refresh news with new language
    fetchNews(state.currentCategory, state.currentFilters);
};

// Optimize fetchNews function with better error handling
const fetchNews = async (category = state.currentCategory, filters = {}) => {
    if (state.isLoading) {
        console.log('Already loading news, skipping request');
        return;
    }
    
    try {
        state.isLoading = true;
        console.log('Fetching news for category:', category, 'language:', state.language);
        showLoading(elements.newsGrid);
        
        const isServerRunning = await checkServerStatus();
        if (!isServerRunning) {
            throw new Error('Server is not responding. Please check if the server is running and try again.');
        }
        
        // Construct the API URL with category, filters, and language
        const params = new URLSearchParams({
            category,
            language: state.language,
            ...filters
        });
        
        const response = await fetch(`${API_BASE_URL}/news?${params}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch news: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.articles || !Array.isArray(data.articles)) {
            throw new Error('Invalid response format from server');
        }
        
        // Update the news grid with the fetched articles
        elements.newsGrid.innerHTML = data.articles.map((article, index) => 
            createNewsCard(article, index)
        ).join('');
        
        // Initialize image loading after updating the grid
        initializeImageLoading();
        
        // Update source filter if needed
        if (data.articles.length > 0) {
            updateSourceFilter(data.articles);
        }
        
    } catch (error) {
        console.error('Error fetching news:', error);
        showError(elements.newsGrid, error.message);
    } finally {
        state.isLoading = false;
    }
};

const searchNews = async (query, filters = {}) => {
    if (!query.trim()) {
        fetchNews(state.currentCategory, filters);
        return;
    }

    try {
        showLoading(elements.newsGrid);
        
        // Prepare search parameters
        const searchParams = new URLSearchParams();
        searchParams.append('q', query.trim());
        searchParams.append('language', state.language);
        
        // Add filters if they exist
        if (filters.source) searchParams.append('source', filters.source);
        if (filters.date) searchParams.append('date', filters.date);
        if (filters.sentiment) searchParams.append('sentiment', filters.sentiment);

        console.log('Searching with params:', searchParams.toString());
        
        const response = await fetch(`${API_BASE_URL}/search?${searchParams.toString()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.details || `Search failed: ${response.status} ${response.statusText}`);
        }

        if (!data.articles || data.articles.length === 0) {
            elements.newsGrid.innerHTML = `
                <div class="no-news-message">
                    <i class="fas fa-search"></i>
                    <p>No articles found for "${query}"</p>
                    <p class="text-sm text-gray-500 mt-2">Try different keywords or filters</p>
                </div>
            `;
            return null;
        }

        // Update source filter options
        updateSourceFilter(data.articles);

        elements.newsGrid.className = state.viewType === 'grid' ? 'news-grid' : 'news-list';
        elements.newsGrid.innerHTML = data.articles
            .map((article, index) => createNewsCard(article, index))
            .join('');

        // Add event listeners to new elements
        addEventListeners();

        return data;
    } catch (error) {
        console.error('Error searching news:', error);
        elements.newsGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Search Error</h3>
                <p>${error.message}</p>
                <button onclick="retrySearch()" class="retry-button">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
        return null;
    }
};

const fetchDigest = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/digest?language=${state.language}`);
        if (!response.ok) {
            throw new Error('Failed to fetch digest');
        }
        const data = await response.json();
        
        if (!data || Object.keys(data).length === 0) {
            elements.digestContent.innerHTML = `
                <div class="no-digest-message">
                    <i class="fas fa-newspaper"></i>
                    <p>No digest available at the moment</p>
                </div>
            `;
            return;
        }

        // Create digest content
        const digestHTML = Object.entries(data)
            .filter(([key]) => key !== 'timestamp')
            .map(([category, articles]) => `
                <div class="digest-category">
                    <h4>${category.toUpperCase()}</h4>
                    ${articles.map(article => `
                        <div class="digest-item">
                            <h5>${article.title}</h5>
                            <p>${article.summary || article.description || 'No summary available'}</p>
                            <div class="digest-meta">
                                <span class="digest-source">${article.source?.name || 'Unknown Source'}</span>
                                <span class="digest-time">${formatDate(article.publishedAt)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('');
        
        elements.digestContent.innerHTML = digestHTML;
    } catch (error) {
        console.error('Error fetching digest:', error);
        elements.digestContent.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load daily digest</p>
                <button onclick="fetchDigest()" class="retry-button">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
};

// Event Handlers
const handleLike = (e) => {
    const btn = e.currentTarget;
    const icon = btn.querySelector('i');
    icon.classList.toggle('far');
    icon.classList.toggle('fas');
    icon.classList.toggle('text-red-500');
};

const handleBookmark = (e) => {
    const btn = e.currentTarget;
    const icon = btn.querySelector('i');
    icon.classList.toggle('far');
    icon.classList.toggle('fas');
    icon.classList.toggle('text-blue-500');
};

const handleShare = (e) => {
    const article = e.target.closest('.news-card');
    const title = article.querySelector('h2').textContent;
    const url = article.querySelector('a').href;

    if (navigator.share) {
        navigator.share({
            title: title,
            url: url
        });
    } else {
        // Fallback for browsers that don't support Web Share API
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = url;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        
        // Show copied notification
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg';
        notification.textContent = 'Link copied to clipboard!';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }
};

// Optimize event handlers with debouncing
const debouncedSearch = debounce((query, filters) => {
    if (query) {
        searchNews(query, filters);
    } else {
        fetchNews(state.currentCategory, filters);
    }
}, 500);

const debouncedScroll = debounce(() => {
    if (state.scrollTimeout) {
        window.cancelAnimationFrame(state.scrollTimeout);
    }

    state.scrollTimeout = window.requestAnimationFrame(() => {
        const currentScroll = window.pageYOffset;
        const navbar = document.querySelector('.navbar');
        
        if (currentScroll > state.lastScrollPosition && currentScroll > 100) {
            navbar.classList.add('hidden');
        } else {
            navbar.classList.remove('hidden');
        }
        
        state.lastScrollPosition = currentScroll;
    });
}, 100);

// Initialize category filter
const initializeCategoryFilter = () => {
    const categories = ['general', 'business', 'technology', 'sports', 'entertainment', 'health', 'science'];
    const categoryFilter = elements.categoryFilter;
    
    // Clear existing options except the first one
    while (categoryFilter.options.length > 1) {
        categoryFilter.remove(1);
    }
    
    // Add category options
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        categoryFilter.appendChild(option);
    });
};

// Update event listeners
const addEventListeners = () => {
    if (state.eventListenersInitialized) {
        console.log('Event listeners already initialized');
        return;
    }

    try {
        // Search input
        elements.searchInput?.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.trim();
            debouncedSearch(state.searchQuery, state.currentFilters);
        });

        // Filter changes
        elements.sourceFilter?.addEventListener('change', (e) => {
            state.currentFilters.source = e.target.value;
            debouncedSearch(state.searchQuery, state.currentFilters);
        });

        elements.sentimentFilter?.addEventListener('change', (e) => {
            state.currentFilters.sentiment = e.target.value;
            debouncedSearch(state.searchQuery, state.currentFilters);
        });

        // Category links
        categoryLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.target.closest('[data-category]').dataset.category;
                state.currentCategory = category;
                
                // Update active state
                categoryLinks.forEach(l => l.classList.remove('active'));
                e.target.closest('[data-category]').classList.add('active');
                
                // Reset search and filters when changing category
                state.searchQuery = '';
                state.currentFilters = {
                    source: '',
                    sentiment: ''
                };
                elements.searchInput.value = '';
                elements.sourceFilter.value = '';
                elements.sentimentFilter.value = '';
                
                fetchNews(category);
                fetchTrendingTopics();
            });
        });

        // View toggle
        elements.viewToggle?.addEventListener('click', (e) => {
            e.preventDefault();
            const newViewType = state.viewType === 'grid' ? 'list' : 'grid';
            state.viewType = newViewType;
            localStorage.setItem('viewType', newViewType);
            
            // Update active state
            const viewButtons = elements.viewToggle.querySelectorAll('.view-btn');
            viewButtons.forEach(btn => btn.classList.remove('active'));
            e.target.closest('.view-btn').classList.add('active');
            
            // Update news container class
            elements.newsGrid.className = `news-${newViewType}`;
            
            // Update icon
            const viewIcon = elements.viewToggle.querySelector('i');
            viewIcon.className = newViewType === 'grid' ? 'fas fa-th-large' : 'fas fa-list';
            
            // Get current articles from the DOM
            const currentArticles = Array.from(elements.newsGrid.children).map(card => {
                const title = card.querySelector('h2').textContent;
                const description = card.querySelector('p').textContent;
                const source = card.querySelector('.text-sm').textContent;
                const date = card.querySelectorAll('.text-sm')[1].textContent;
                const image = card.querySelector('img').src;
                const url = card.querySelector('a').href;
                return { 
                    title, 
                    description, 
                    source: { name: source }, 
                    publishedAt: date, 
                    urlToImage: image, 
                    url 
                };
            });

            // Re-render articles with new view type
            if (currentArticles.length > 0) {
                elements.newsGrid.innerHTML = currentArticles
                    .map((article, index) => createNewsCard(article, index))
                    .join('');
                
                // Reinitialize lazy loading and event listeners
                lazyLoadImages();
            }
        });

        // Theme toggle
        elements.themeToggle?.addEventListener('click', () => {
            try {
                const newTheme = state.theme === 'light' ? 'dark' : 'light';
                state.theme = newTheme;
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                
                // Update theme toggle icon
                const themeIcon = elements.themeToggle?.querySelector('i');
                if (themeIcon) {
                    themeIcon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
                }

                // Update meta theme-color for mobile browsers
                const metaThemeColor = document.querySelector('meta[name="theme-color"]');
                if (metaThemeColor) {
                    metaThemeColor.setAttribute('content', newTheme === 'light' ? '#ffffff' : '#111827');
                }
            } catch (error) {
                console.error('Error toggling theme:', error);
            }
        });

        // Scroll event
        window.addEventListener('scroll', debouncedScroll, { passive: true });

        // Category filter change
        elements.categoryFilter?.addEventListener('change', (e) => {
            const category = e.target.value;
            if (category) {
                state.currentCategory = category;
                // Update active state in category links
                categoryLinks.forEach(link => {
                    if (link.dataset.category === category) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
                fetchNews(category, state.currentFilters);
            }
        });

        // Add language toggle event listener
        const langToggle = document.getElementById('languageToggle');
        if (langToggle) {
            langToggle.addEventListener('click', toggleLanguage);
        }

        state.eventListenersInitialized = true;
        console.log('Event listeners initialized successfully');
    } catch (error) {
        console.error('Error initializing event listeners:', error);
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure theme is set before any content is rendered
    document.documentElement.setAttribute('data-theme', state.theme);
    
    // Update theme toggle icon
    const themeIcon = elements.themeToggle?.querySelector('i');
    if (themeIcon) {
        themeIcon.className = state.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', state.theme === 'light' ? '#ffffff' : '#111827');
    }

    // Set initial view type
    elements.newsGrid.className = `news-${state.viewType}`;
    const viewIcon = elements.viewToggle.querySelector('i');
    viewIcon.className = state.viewType === 'grid' ? 'fas fa-th-large' : 'fas fa-list';
    
    // Set initial language
    const langToggle = document.getElementById('languageToggle');
    if (langToggle) {
        langToggle.innerHTML = state.language === 'en' ? 'हिंदी' : 'English';
    }
    
    // Add event listeners
    addEventListeners();
    
    // Initial data fetch
    await Promise.all([
        fetchNews(state.currentCategory),
        fetchDigest(),
        fetchTrendingTopics()
    ]);
    
    // Set up periodic updates
    setInterval(fetchDigest, 30 * 60 * 1000); // Update digest every 30 minutes
    setInterval(fetchTrendingTopics, 15 * 60 * 1000); // Update trending topics every 15 minutes
    
    // Set initial active category
    categoryLinks[0].classList.add('active');
    
    // Initialize weather with user's location
    try {
        await updateWeatherWidget();
        // Update weather every 30 minutes
        setInterval(updateWeatherWidget, 30 * 60 * 1000);
    } catch (error) {
        console.error('Error initializing weather:', error);
        elements.weatherContent.innerHTML = `
            <div class="weather-widget error">
                <i class="fas fa-exclamation-circle text-red-500 mb-2"></i>
                <p class="text-red-500">Failed to load weather data</p>
                <button onclick="updateWeatherWidget()" class="retry-button mt-2">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
    
    // Initialize category filter
    initializeCategoryFilter();
});

// Add retry function
const retryFetch = () => {
    fetchNews(state.currentCategory);
};

// Add retry search function
const retrySearch = () => {
    const query = elements.searchInput.value.trim();
    const filters = {
        source: elements.sourceFilter.value,
        sentiment: elements.sentimentFilter.value
    };
    
    // Remove empty filter values
    Object.keys(filters).forEach(key => {
        if (!filters[key]) {
            delete filters[key];
        }
    });

    if (query) {
        searchNews(query, filters);
    } else {
        fetchNews(state.currentCategory, filters);
    }
};

// Add retry digest function
const retryDigest = () => {
    fetchDigest();
};

// Add function to update source filter options
const updateSourceFilter = (articles) => {
    const sources = new Set();
    articles.forEach(article => {
        if (article.source?.name) {
            sources.add(article.source.name);
        }
    });

    const sourceFilter = elements.sourceFilter;
    const currentValue = sourceFilter.value;
    
    // Clear existing options except the first one
    while (sourceFilter.options.length > 1) {
        sourceFilter.remove(1);
    }

    // Add new options
    Array.from(sources).sort().forEach(source => {
        const option = document.createElement('option');
        option.value = source;
        option.textContent = source;
        sourceFilter.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentValue && sources.has(currentValue)) {
        sourceFilter.value = currentValue;
    }
};

// Add CSS for image loading states
const style = document.createElement('style');
style.textContent = `
    .image-container {
        position: relative;
        overflow: hidden;
    }

    .news-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .line-clamp-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
`;
document.head.appendChild(style);

// Initialize image loading
const initializeImageLoading = () => {
    const images = document.querySelectorAll('.news-image');
    images.forEach(img => {
        if (!img.complete) {
            img.classList.add('loading');
        }
    });
};

const fetchTrendingTopics = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/news?category=${state.currentCategory}&language=${state.language}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch trending topics: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.articles || data.articles.length === 0) {
            elements.trendingContent.innerHTML = `
                <div class="no-trending-message">
                    <i class="fas fa-chart-line"></i>
                    <p>No trending topics available</p>
                </div>
            `;
            return;
        }

        // Get top 5 trending articles based on sentiment score and recency
        const trendingArticles = data.articles
            .sort((a, b) => {
                // Sort by sentiment score and recency
                const scoreA = Math.abs(a.sentimentScore || 0);
                const scoreB = Math.abs(b.sentimentScore || 0);
                const dateA = new Date(a.publishedAt);
                const dateB = new Date(b.publishedAt);
                
                // Weight the sentiment score and recency
                return (scoreB * 0.7 + (dateB - dateA) * 0.3) - (scoreA * 0.7 + (dateA - dateB) * 0.3);
            })
            .slice(0, 5);

        // Update trending topics display
        elements.trendingContent.innerHTML = trendingArticles
            .map((article, index) => createTrendingItem(article, index))
            .join('');

    } catch (error) {
        console.error('Error fetching trending topics:', error);
        elements.trendingContent.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load trending topics</p>
                <button onclick="fetchTrendingTopics()" class="retry-button">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
}; 