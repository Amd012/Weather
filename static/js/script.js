document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const searchForm = document.getElementById('search-form');
    const locationInput = document.getElementById('location-input');
    const weatherContainer = document.getElementById('weather-container');
    const loadingContainer = document.getElementById('loading-container');
    const welcomeContainer = document.getElementById('welcome-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const toggleUnitsBtn = document.getElementById('toggle-units');
    const toggleThemeBtn = document.getElementById('toggle-theme');
    const addFavoriteBtn = document.getElementById('add-favorite');
    const favoritesList = document.getElementById('favorites-list');
    const historyList = document.getElementById('history-list');
    
    // Add location button event listener
    const locationButton = document.getElementById('get-location');
    if (locationButton) {
        locationButton.addEventListener('click', handleLocationClick);
    }
    
    // State variables
    let currentWeatherData = null;
    let units = 'metric'; // 'metric' for Celsius, 'imperial' for Fahrenheit
    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    
    // Initialize application
    init();
    
    function init() {
        // Load theme from localStorage
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            toggleThemeBtn.innerHTML = '<i class="fas fa-sun"></i>';
        }
        
        // Load favorites
        renderFavorites();
        
        // Load search history
        fetchSearchHistory();
        
        // Set up event listeners
        searchForm.addEventListener('submit', handleSearch);
        toggleUnitsBtn.addEventListener('click', toggleUnits);
        toggleThemeBtn.addEventListener('click', toggleTheme);
        addFavoriteBtn.addEventListener('click', toggleFavorite);
        document.getElementById('get-location').addEventListener('click', getCurrentLocation);
    }
    
    // Event Handlers
    function handleSearch(e) {
        e.preventDefault();
        const location = locationInput.value.trim();
        
        if (location) {
            fetchWeatherData(location);
        }
    }
    
    function toggleUnits() {
        units = units === 'metric' ? 'imperial' : 'metric';
        toggleUnitsBtn.textContent = units === 'metric' ? '°C / °F' : '°F / °C';
        
        // Update displayed temperature if we have weather data
        if (currentWeatherData) {
            updateWeatherDisplay(currentWeatherData);
        }
    }
    
    function toggleTheme() {
        const isDarkTheme = document.body.classList.toggle('dark-theme');
        toggleThemeBtn.innerHTML = isDarkTheme ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    }
    
    function toggleFavorite() {
        if (!currentWeatherData) return;
        
        const locationName = currentWeatherData.current.name;
        const isFavorite = favorites.includes(locationName);
        
        if (isFavorite) {
            // Remove from favorites
            favorites = favorites.filter(fav => fav !== locationName);
            addFavoriteBtn.innerHTML = '<i class="far fa-heart"></i> Add to favorites';
            addFavoriteBtn.classList.remove('active');
        } else {
            // Add to favorites
            favorites.push(locationName);
            addFavoriteBtn.innerHTML = '<i class="fas fa-heart"></i> Remove from favorites';
            addFavoriteBtn.classList.add('active');
        }
        
        // Save to localStorage
        localStorage.setItem('favorites', JSON.stringify(favorites));
        
        // Update favorites list
        renderFavorites();
    }
    
    // API Calls
    function fetchWeatherData(location) {
        // Show loading state
        showLoadingState();
        
        // Make API call to our Flask backend
        fetch('/weather', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ location }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showErrorState(data.error);
                return;
            }
            
            // Store the data
            currentWeatherData = data;
            // Update the UI
            updateWeatherDisplay(data);
            
            // Show weather container
            hideAllContainers();
            weatherContainer.classList.remove('hidden');
            
            // Update favorite button state
            updateFavoriteButtonState(data.current.name);
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorState('Network error. Please try again later.');
        });
    }
    
    function fetchSearchHistory() {
        fetch('/history')
            .then(response => response.json())
            .then(data => {
                renderSearchHistory(data);
            })
            .catch(error => {
                console.error('Error fetching history:', error);
            });
    }
    
    async function fetchWeatherByCoordinates(lat, lon) {
        try {
            const response = await fetch(`/weather/coordinates?lat=${lat}&lon=${lon}`);
            if (!response.ok) throw new Error('Weather data not found');
            const data = await response.json();
            updateWeatherUI(data);
        } catch (error) {
            showError("Failed to fetch weather data for your location.");
        }
    }

    async function handleLocationClick() {
        const locationButton = document.getElementById('get-location');
        locationButton.classList.add('loading');

        try {
            const position = await getCurrentPosition();
            const { latitude, longitude } = position.coords;
            
            // Fetch weather data using coordinates
            await fetchWeatherByCoords(latitude, longitude);
            
        } catch (error) {
            showError(error.message);
        } finally {
            locationButton.classList.remove('loading');
        }
    }

    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => resolve(position),
                error => {
                    let errorMessage;
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = "Location access denied. Please enable location services.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = "Location information unavailable.";
                            break;
                        case error.TIMEOUT:
                            errorMessage = "Location request timed out.";
                            break;
                        default:
                            errorMessage = "An unknown error occurred.";
                    }
                    reject(new Error(errorMessage));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        });
    }

    async function fetchWeatherByCoords(lat, lon) {
        try {
            const response = await fetch(`/weather/coordinates?lat=${lat}&lon=${lon}`);
            if (!response.ok) throw new Error('Failed to fetch weather data');
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            // Store the data
            currentWeatherData = data;
            
            // Update the UI
            updateWeatherDisplay(data);
            
            // Show weather container
            hideAllContainers();
            weatherContainer.classList.remove('hidden');
            
            // Update favorite button state if applicable
            if (data.current && data.current.name) {
                updateFavoriteButtonState(data.current.name);
            }
            
        } catch (error) {
            showError(error.message);
        }
    }

    // UI Update Functions
    function updateWeatherDisplay(data) {
        // Current Weather
        document.getElementById('location-name').textContent = `${data.current.name}, ${data.current.country}`;
        document.getElementById('current-date').textContent = formatDate(new Date(), 'full');
        
        const temp = units === 'metric' ? data.current.main.temp : celsiusToFahrenheit(data.current.main.temp);
        const feelsLike = units === 'metric' ? data.current.main.feels_like : celsiusToFahrenheit(data.current.main.feels_like);
        const tempUnit = units === 'metric' ? '°C' : '°F';
        
        document.getElementById('current-temp').textContent = `${Math.round(temp)}${tempUnit}`;
        document.getElementById('weather-description').textContent = data.current.weather.description;
        document.getElementById('feels-like').textContent = `${Math.round(feelsLike)}${tempUnit}`;
        document.getElementById('humidity').textContent = `${data.current.main.humidity}%`;
        document.getElementById('wind-speed').textContent = units === 'metric' ? 
            `${data.current.wind.speed} m/s` : 
            `${(data.current.wind.speed * 2.237).toFixed(1)} mph`;
        document.getElementById('pressure').textContent = `${data.current.main.pressure} hPa`;
        
        // Weather Icon
        const weatherIcon = getWeatherIcon(data.current.weather.id);
        document.getElementById('weather-icon').className = weatherIcon;
        
        // Forecast
        renderForecast(data.forecast);
        
        // Air Quality
        if (data.air_quality && !data.air_quality.error) {
            renderAirQuality(data.air_quality);
        }
        
        // Hourly forecast for today
        if (data.forecast && data.forecast.length > 0) {
            renderHourlyForecast(data.forecast[0].hourly);
        }
    }
    
    function renderForecast(forecast) {
        const forecastContainer = document.getElementById('forecast-container');
        forecastContainer.innerHTML = '';
        
        forecast.forEach((day, index) => {
            if (index >= 5) return; // Show only 5 days
            
            const date = new Date(day.date);
            const minTemp = units === 'metric' ? day.min_temp : celsiusToFahrenheit(day.min_temp);
            const maxTemp = units === 'metric' ? day.max_temp : celsiusToFahrenheit(day.max_temp);
            const tempUnit = units === 'metric' ? '°C' : '°F';
            
            const forecastDay = document.createElement('div');
            forecastDay.className = 'forecast-day';
            forecastDay.innerHTML = `
                <div class="forecast-date">${formatDate(date, 'short')}</div>
                <div class="forecast-icon">
                    <i class="${getWeatherIcon(day.weather.id)}"></i>
                </div>
                <div class="forecast-description">${day.weather.description}</div>
                <div class="forecast-temp">
                    <div class="max-temp">${Math.round(maxTemp)}${tempUnit}</div>
                    <div class="min-temp">${Math.round(minTemp)}${tempUnit}</div>
                </div>
            `;
            forecastContainer.appendChild(forecastDay);
        });
    }
    
    function renderAirQuality(airQuality) {
        const aqiValue = document.getElementById('aqi-value');
        const aqiLabel = document.getElementById('aqi-label');
        
        // Air Quality Index
        const aqi = airQuality.main.aqi;
        aqiValue.textContent = aqi;
        
        // Set AQI label and color
        let aqiText, aqiColor;
        switch(aqi) {
            case 1:
                aqiText = 'Good';
                aqiColor = 'var(--aqi-good)';
                break;
            case 2:
                aqiText = 'Moderate';
                aqiColor = 'var(--aqi-moderate)';
                break;
            case 3:
                aqiText = 'Unhealthy for Sensitive Groups';
                aqiColor = 'var(--aqi-unhealthy-sensitive)';
                break;
            case 4:
                aqiText = 'Unhealthy';
                aqiColor = 'var(--aqi-unhealthy)';
                break;
            case 5:
                aqiText = 'Very Unhealthy';
                aqiColor = 'var(--aqi-very-unhealthy)';
                break;
            default:
                aqiText = 'Unknown';
                aqiColor = 'gray';
        }
        
        aqiLabel.textContent = aqiText;
        aqiLabel.style.backgroundColor = aqiColor;
        
        // Pollutants
        const components = airQuality.components;
        document.getElementById('pm2_5').textContent = `${components.pm2_5.toFixed(1)} µg/m³`;
        document.getElementById('pm10').textContent = `${components.pm10.toFixed(1)} µg/m³`;
        document.getElementById('no2').textContent = `${components.no2.toFixed(1)} µg/m³`;
        document.getElementById('o3').textContent = `${components.o3.toFixed(1)} µg/m³`;
    }
    
    function renderHourlyForecast(hourlyData) {
        const hourlyContainer = document.getElementById('hourly-container');
        hourlyContainer.innerHTML = '';
        
        // Get current hour to filter out past hours
        const currentHour = new Date().getHours();
        
        // Filter and limit hourly data
        const filteredHourly = hourlyData
            .filter(hour => {
                const hourDate = new Date(hour.dt * 1000);
                // Include if it's future hour or within the last hour
                return hourDate.getHours() >= currentHour || hourDate.getDay() > new Date().getDay();
            })
            .slice(0, 24); // Show 24 hours
        
        filteredHourly.forEach(hour => {
            const hourDate = new Date(hour.dt * 1000);
            const hourTemp = units === 'metric' ? hour.main.temp : celsiusToFahrenheit(hour.main.temp);
            const tempUnit = units === 'metric' ? '°C' : '°F';
            
            const hourlyItem = document.createElement('div');
            hourlyItem.className = 'hourly-item';
            hourlyItem.innerHTML = `
                <div class="hourly-time">${formatTime(hourDate)}</div>
                <div class="hourly-icon">
                    <i class="${getWeatherIcon(hour.weather[0].id)}"></i>
                </div>
                <div class="hourly-temp">${Math.round(hourTemp)}${tempUnit}</div>
            `;
            hourlyContainer.appendChild(hourlyItem);
        });
    }
    
    function renderFavorites() {
        favoritesList.innerHTML = '';
        
        if (favorites.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No favorite locations yet';
            favoritesList.appendChild(emptyItem);
            return;
        }
        
        favorites.forEach(location => {
            const listItem = document.createElement('li');
            
            const locationName = document.createElement('span');
            locationName.textContent = location;
            locationName.addEventListener('click', () => {
                locationInput.value = location;
                fetchWeatherData(location);
            });
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-favorite';
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                favorites = favorites.filter(fav => fav !== location);
                localStorage.setItem('favorites', JSON.stringify(favorites));
                renderFavorites();
                
                // Update favorite button if current location
                if (currentWeatherData && currentWeatherData.current.name === location) {
                    updateFavoriteButtonState(location);
                }
            });
            
            listItem.appendChild(locationName);
            listItem.appendChild(removeBtn);
            favoritesList.appendChild(listItem);
        });
    }
    
    function renderSearchHistory(history) {
        historyList.innerHTML = '';
        
        if (history.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No recent searches';
            historyList.appendChild(emptyItem);
            return;
        }
        
        history.forEach(item => {
            const listItem = document.createElement('li');
            listItem.textContent = item.location;
            listItem.addEventListener('click', () => {
                locationInput.value = item.location;
                fetchWeatherData(item.location);
            });
            historyList.appendChild(listItem);
        });
    }
    
    function updateFavoriteButtonState(locationName) {
        const isFavorite = favorites.includes(locationName);
        
        if (isFavorite) {
            addFavoriteBtn.innerHTML = '<i class="fas fa-heart"></i> Remove from favorites';
            addFavoriteBtn.classList.add('active');
        } else {
            addFavoriteBtn.innerHTML = '<i class="far fa-heart"></i> Add to favorites';
            addFavoriteBtn.classList.remove('active');
        }
    }
    
    // Helper Functions
    function formatDate(date, format) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        if (format === 'short') {
            return new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            }).format(date);
        }
        
        return new Intl.DateTimeFormat('en-US', options).format(date);
    }
    
    function formatTime(date) {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: true
        }).format(date);
    }
    
    function celsiusToFahrenheit(celsius) {
        return (celsius * 9/5) + 32;
    }
    
    function getWeatherIcon(weatherId) {
        // Map OpenWeatherMap weather ID to Font Awesome icons
        if (weatherId >= 200 && weatherId < 300) {
            return 'fas fa-bolt';
        } else if (weatherId >= 300 && weatherId < 400) {
            return 'fas fa-cloud-rain';
        } else if (weatherId >= 500 && weatherId < 600) {
            return 'fas fa-umbrella';
        } else if (weatherId >= 600 && weatherId < 700) {
            return 'fas fa-snowflake';
        } else if (weatherId >= 700 && weatherId < 800) {
            return 'fas fa-smog';
        } else if (weatherId === 800) {
            return 'fas fa-sun';
        } else if (weatherId > 800) {
            return 'fas fa-cloud';
        } else {
            return 'fas fa-question';
        }
    }
    
    function showLoadingState() {
        hideAllContainers();
        loadingContainer.classList.remove('hidden');
    }
    
    function showError(message) {
        const errorContainer = document.getElementById('error-container');
        const weatherContainer = document.getElementById('weather-container');
        const welcomeContainer = document.getElementById('welcome-container');

        errorContainer.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;

        errorContainer.classList.remove('hidden');
        weatherContainer.classList.add('hidden');
        welcomeContainer.classList.add('hidden');
    }
    
    function hideAllContainers() {
        weatherContainer.classList.add('hidden');
        loadingContainer.classList.add('hidden');
        welcomeContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
    }
});