document.addEventListener('DOMContentLoaded', () => {
    const locationButton = document.getElementById('get-location');
    if (locationButton) {
        locationButton.addEventListener('click', getUserLocation);
    }
});

async function handleLocationClick() {
    const locationButton = document.getElementById('get-location');
    locationButton.classList.add('loading');

    try {
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;
        
        // Fetch weather data using coordinates
        const response = await fetch(`/weather/coordinates?lat=${latitude}&lon=${longitude}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Update weather display
        updateWeatherDisplay(data);
        
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

function getUserLocation() {
    fetch("/get_location")
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to get location');
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            document.getElementById("location-input").value = data.city;
            getWeather();
        })
        .catch(error => {
            console.error('Error:', error);
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = error.message;
            }
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

        // Update weather display
        updateWeatherDisplay(data);
        
    } catch (error) {
        showError(error.message);
    } finally {
        document.getElementById('loading-container').classList.add('hidden');
    }
}

function handleLocationError(error) {
    let message;
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "Location permission denied. Please enable location services.";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable.";
            break;
        case error.TIMEOUT:
            message = "Location request timed out.";
            break;
        default:
            message = "An unknown error occurred getting location.";
    }
    showError(message);
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

function updateWeatherDisplay(data) {
    try {
        const weatherContainer = document.getElementById('weather-container');
        
        // Show weather container and hide others
        weatherContainer.classList.remove('hidden');
        document.getElementById('welcome-container').classList.add('hidden');
        document.getElementById('error-container').classList.add('hidden');

        // Update current weather
        document.querySelector('.location-info h2').textContent = `${data.current.name}, ${data.current.sys.country}`;
        document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Update temperature and description
        document.querySelector('.temperature h2').textContent = `${Math.round(data.current.main.temp)}°C`;
        document.getElementById('weather-description').textContent = data.current.weather.description;

        // Update weather icon
        const weatherIcon = document.querySelector('.weather-icon i');
        weatherIcon.className = `fas ${getWeatherIconClass(data.current.weather.id)}`;

        // Update details
        document.getElementById('feels-like').textContent = `${Math.round(data.current.main.feels_like)}°C`;
        document.getElementById('humidity').textContent = `${data.current.main.humidity}%`;
        document.getElementById('wind-speed').textContent = `${data.current.wind.speed} m/s`;

        // Update forecast if available
        if (data.forecast && data.forecast.length > 0) {
            updateForecast(data.forecast);
        }

        // Update air quality if available
        if (data.air_quality) {
            updateAirQuality(data.air_quality);
        }

        // Update day/night indicator
        updateDayNightIndicator(data.is_day);

    } catch (error) {
        console.error('Error updating weather display:', error);
        showError('Error updating weather display');
    }
}

function getWeatherIconClass(weatherId) {
    // Map weather codes to Font Awesome icons
    if (weatherId >= 200 && weatherId < 300) return 'fa-bolt'; // Thunderstorm
    if (weatherId >= 300 && weatherId < 500) return 'fa-cloud-rain'; // Drizzle
    if (weatherId >= 500 && weatherId < 600) return 'fa-rain'; // Rain
    if (weatherId >= 600 && weatherId < 700) return 'fa-snowflake'; // Snow
    if (weatherId >= 700 && weatherId < 800) return 'fa-smog'; // Atmosphere
    if (weatherId === 800) return 'fa-sun'; // Clear
    if (weatherId > 800) return 'fa-cloud'; // Clouds
    return 'fa-cloud'; // Default
}

function updateForecast(forecast) {
    const forecastContainer = document.querySelector('.forecast-container');
    if (!forecastContainer) return;

    forecastContainer.innerHTML = forecast.map(day => `
        <div class="forecast-day">
            <div class="forecast-date">${formatDate(day.date)}</div>
            <div class="forecast-icon">
                <i class="fas ${getWeatherIconClass(day.weather.id)}"></i>
            </div>
            <div class="forecast-temp">
                <span class="max-temp">${Math.round(day.max_temp)}°</span>
                <span class="min-temp">${Math.round(day.min_temp)}°</span>
            </div>
        </div>
    `).join('');
}

function updateAirQuality(airQuality) {
    const aqiContainer = document.querySelector('.air-quality-index');
    if (!aqiContainer) return;

    const aqi = airQuality.main.aqi;
    const aqiLabels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    const aqiColors = ['#4caf50', '#ffeb3b', '#ff9800', '#f44336', '#9c27b0'];

    aqiContainer.innerHTML = `
        <div class="aqi-value">${aqi}</div>
        <div class="aqi-label" style="background-color: ${aqiColors[aqi - 1]}">
            ${aqiLabels[aqi - 1]}
        </div>
    `;
}

function updateDayNightIndicator(isDay) {
    const indicator = document.querySelector('.day-night-indicator');
    if (!indicator) return;

    if (isDay) {
        indicator.classList.remove('night-indicator');
        indicator.classList.add('day-indicator');
        indicator.innerHTML = '<i class="fas fa-sun"></i> Day';
    } else {
        indicator.classList.remove('day-indicator');
        indicator.classList.add('night-indicator');
        indicator.innerHTML = '<i class="fas fa-moon"></i> Night';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}