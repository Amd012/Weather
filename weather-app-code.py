from flask import Flask, render_template, request, jsonify
import requests
import os
from datetime import datetime, timedelta
import json
import time
import logging

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)

API_KEY = "42a67cadf260ef5965879b0c4688f6f3"
BASE_URL = "https://api.openweathermap.org/data/2.5/"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/weather', methods=['POST'])
def get_weather():
    data = request.get_json()
    location = data.get('location', '')
    
    try:
        # Get current weather
        current_weather = get_current_weather(location)
        
        if 'error' in current_weather:
            return jsonify(current_weather)
        
        # Get forecast
        forecast = get_forecast(location)
        
        # Get air quality 
        air_quality = get_air_quality(current_weather['coord']['lat'], 
                                    current_weather['coord']['lon'])
        
        # Is it day or night?
        sunrise = current_weather['sys']['sunrise']
        sunset = current_weather['sys']['sunset']
        current_time = current_weather['dt']
        is_day = sunrise < current_time < sunset
        
        result = {
            'current': current_weather,
            'forecast': forecast,
            'air_quality': air_quality,
            'is_day': is_day
        }
        
        # Save to history
        save_to_history(location, current_weather)
        
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error processing weather request: {str(e)}")
        return jsonify({'error': f"Error processing request: {str(e)}"})

@app.route('/weather/coordinates', methods=['GET'])
def weather_by_coordinates():
    try:
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        
        if not lat or not lon:
            return jsonify({'error': 'Latitude and longitude are required'}), 400

        # Get current weather
        url = f"{BASE_URL}weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        response = requests.get(url)
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to fetch weather data'}), response.status_code
            
        current_weather = response.json()

        # Get forecast
        forecast_url = f"{BASE_URL}forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        forecast_response = requests.get(forecast_url)
        forecast_data = forecast_response.json()
        
        # Get air quality
        air_quality = get_air_quality(lat, lon)

        # Determine if it's day or night
        sunrise = current_weather['sys']['sunrise']
        sunset = current_weather['sys']['sunset']
        current_time = current_weather['dt']
        is_day = sunrise < current_time < sunset

        result = {
            'current': current_weather,
            'forecast': process_forecast_data(forecast_data),
            'air_quality': air_quality,
            'is_day': is_day
        }

        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Error in weather_by_coordinates: {str(e)}")
        return jsonify({'error': str(e)}), 500

def process_forecast_data(data):
    try:
        forecast_by_day = {}
        for item in data['list']:
            date = datetime.fromtimestamp(item['dt']).strftime('%Y-%m-%d')
            if date not in forecast_by_day:
                forecast_by_day[date] = []
            forecast_by_day[date].append(item)
        
        daily_forecast = []
        for date, items in forecast_by_day.items():
            min_temp = min(item['main']['temp_min'] for item in items)
            max_temp = max(item['main']['temp_max'] for item in items)
            
            weather_counts = {}
            for item in items:
                weather_id = item['weather'][0]['id']
                weather_counts[weather_id] = weather_counts.get(weather_id, 0) + 1
            
            most_common_weather_id = max(weather_counts, key=weather_counts.get)
            most_common_weather = next(item['weather'][0] for item in items if item['weather'][0]['id'] == most_common_weather_id)
            
            daily_forecast.append({
                'date': date,
                'min_temp': min_temp,
                'max_temp': max_temp,
                'weather': most_common_weather,
                'hourly': items
            })
            
        return daily_forecast
    except Exception as e:
        app.logger.error(f"Error processing forecast data: {str(e)}")
        return {'error': str(e)}

@app.route('/validate-api')
def validate_api():
    """Endpoint to validate if the API key is working"""
    try:
        # Test API key with a simple request
        test_url = f"{BASE_URL}weather?q=London&appid={API_KEY}"
        response = requests.get(test_url)
        
        if response.status_code == 200:
            return jsonify({
                'status': 'success',
                'message': 'API key is valid'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': f'API key validation failed: {response.status_code}',
                'details': response.text
            })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Exception during API validation: {str(e)}'
        })

@app.route('/history')
def get_history():
    try:
        with open('history.json', 'r') as f:
            history = json.load(f)
        return jsonify(history)
    except FileNotFoundError:
        return jsonify([])

def get_current_weather(location):
    try:
        # Add a small delay to avoid rate limiting
        time.sleep(0.2)
        
        url = f"{BASE_URL}weather?q={location}&appid={API_KEY}&units=metric"
        app.logger.info(f"Making request to: {url}")
        
        response = requests.get(url)
        
        # Check for error status codes
        if response.status_code != 200:
            app.logger.error(f"API error: {response.status_code} - {response.text}")
            return {
                'error': f"Weather API error ({response.status_code}): {response.text}",
                'url': url
            }
        
        data = response.json()
        
        # Format data
        formatted_data = {
            'coord': data['coord'],
            'weather': data['weather'][0],
            'main': data['main'],
            'visibility': data['visibility'],
            'wind': data['wind'],
            'clouds': data['clouds'],
            'dt': data['dt'],
            'sys': data['sys'],
            'timezone': data['timezone'],
            'name': data['name'],
            'country': data['sys']['country']
        }
        
        return formatted_data
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Request exception: {str(e)}")
        return {'error': f"Connection error: {str(e)}"}
    except (KeyError, IndexError) as e:
        app.logger.error(f"Data format error: {str(e)}")
        return {'error': f"Data format error: {str(e)}"}

def get_forecast(location):
    try:
        # Add a small delay to avoid rate limiting
        time.sleep(0.2)
        
        response = requests.get(f"{BASE_URL}forecast?q={location}&appid={API_KEY}&units=metric")
        
        # Check for error status codes
        if response.status_code != 200:
            return {'error': f"Forecast API error ({response.status_code}): {response.text}"}
            
        data = response.json()
        
        # Process forecast data to group by day
        forecast_by_day = {}
        for item in data['list']:
            date = datetime.fromtimestamp(item['dt']).strftime('%Y-%m-%d')
            if date not in forecast_by_day:
                forecast_by_day[date] = []
            forecast_by_day[date].append(item)
            
        # Calculate daily min/max and most common weather
        daily_forecast = []
        for date, items in forecast_by_day.items():
            min_temp = min(item['main']['temp_min'] for item in items)
            max_temp = max(item['main']['temp_max'] for item in items)
            
            # Get most common weather condition
            weather_counts = {}
            for item in items:
                weather_id = item['weather'][0]['id']
                if weather_id not in weather_counts:
                    weather_counts[weather_id] = 0
                weather_counts[weather_id] += 1
            
            most_common_weather_id = max(weather_counts, key=weather_counts.get)
            most_common_weather = next(item['weather'][0] for item in items if item['weather'][0]['id'] == most_common_weather_id)
            
            # Get sunrise/sunset for this day
            day_date = datetime.strptime(date, '%Y-%m-%d')
            
            daily_forecast.append({
                'date': date,
                'min_temp': min_temp,
                'max_temp': max_temp,
                'weather': most_common_weather,
                'hourly': items
            })
            
        return daily_forecast
    except requests.exceptions.RequestException as e:
        return {'error': f"Connection error: {str(e)}"}
    except (KeyError, IndexError) as e:
        return {'error': f"Data format error: {str(e)}"}

def get_air_quality(lat, lon):
    try:
        # Add a small delay to avoid rate limiting
        time.sleep(0.2)
        
        response = requests.get(f"https://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={API_KEY}")
        
        # Check for error status codes
        if response.status_code != 200:
            return {'error': f"Air Quality API error ({response.status_code}): {response.text}"}
            
        data = response.json()
        
        return data['list'][0]
    except requests.exceptions.RequestException as e:
        return {'error': f"Connection error: {str(e)}"}
    except (KeyError, IndexError) as e:
        return {'error': f"Data format error: {str(e)}"}

def is_daytime(weather_data):
    try:
        sunrise = weather_data['sys']['sunrise']
        sunset = weather_data['sys']['sunset']
        current_time = weather_data['dt']
        return sunrise < current_time < sunset
    except KeyError as e:
        app.logger.error(f"Error determining daytime: {str(e)}")
        return True  # Default to daytime if error occurs

def save_to_history(location, weather_data):
    try:
        history = []
        try:
            with open('history.json', 'r') as f:
                history = json.load(f)
        except FileNotFoundError:
            pass
        
        # Add current search to history
        history.append({
            'location': location,
            'weather': weather_data,
            'timestamp': datetime.now().isoformat()
        })
        
        # Keep only the last 10 searches
        if len(history) > 10:
            history = history[-10:]
            
        with open('history.json', 'w') as f:
            json.dump(history, f)
            
    except Exception as e:
        app.logger.error(f"Error saving to history: {str(e)}")

def get_current_weather_by_coords(lat, lon):
    try:
        time.sleep(0.2)  # Rate limiting
        url = f"{BASE_URL}weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        response = requests.get(url)
        
        if response.status_code != 200:
            app.logger.error(f"API error: {response.status_code} - {response.text}")
            return {'error': f"Weather API error: {response.text}"}
        
        data = response.json()
        return {
            'coord': data['coord'],
            'weather': data['weather'][0],
            'main': data['main'],
            'visibility': data.get('visibility'),
            'wind': data['wind'],
            'clouds': data['clouds'],
            'dt': data['dt'],
            'sys': data['sys'],
            'timezone': data['timezone'],
            'name': data['name'],
            'country': data['sys']['country']
        }
    except Exception as e:
        app.logger.error(f"Error in get_current_weather_by_coords: {str(e)}")
        return {'error': str(e)}

def get_forecast_by_coords(lat, lon):
    try:
        time.sleep(0.2)  # Rate limiting
        url = f"{BASE_URL}forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        response = requests.get(url)
        
        if response.status_code != 200:
            return {'error': f"Forecast API error: {response.text}"}
            
        data = response.json()
        return process_forecast_data(data)
    except Exception as e:
        app.logger.error(f"Error in get_forecast_by_coords: {str(e)}")
        return {'error': str(e)}

@app.route('/get_location')
def get_location():
    try:
        # Get IP address
        ip_response = requests.get('https://api.ipify.org?format=json')
        if ip_response.status_code != 200:
            return jsonify({'error': 'Failed to get IP address'}), 400
            
        ip_address = ip_response.json()['ip']
        
        # Get location from IP
        location_response = requests.get(f'http://ip-api.com/json/{ip_address}')
        if location_response.status_code != 200:
            return jsonify({'error': 'Failed to get location from IP'}), 400
            
        location_data = location_response.json()
        
        if location_data['status'] == 'success':
            return jsonify({
                'city': location_data['city'],
                'country': location_data['country'],
                'lat': location_data['lat'],
                'lon': location_data['lon']
            })
        else:
            return jsonify({'error': 'Location not found'}), 404
            
    except Exception as e:
        app.logger.error(f"Error getting location: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)