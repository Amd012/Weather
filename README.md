# Weather Application Website
This is a simple Flask-based web application that fetches and displays real-time weather information using a public wweather API. It's designed to be lightweight, educational, and beginner-friendly.

----

## Features 
- Real-time weather info using an external API
- Temperature, Humidity, Weather, Description, etc..
- Flask-powered backend
- Clean and minimal UI

----

## Setup Instructions
Follow these steps to run this project locally using a virtual environment :

###1. Clone the Repository
 `` bash 
 git clone
 https://github.com/Amd012/weather.git
 cd weather

2.Create a Virtual Environment
#For Windows 
python -m venv venv

#For macOS/Linux
python3 -m venv venv

3.Activate the Virtual Environment
#For Windows (command prompt)
venv\Scripts\activate

#For Windows (Powershell)
.\venv\Scripts\Activate.ps1

#For macOS/Linux 
source venv/bin/activate

4.Install Dependencies
pip install flask ,flask-requests,flask-cors,flask-mail,python-dotenv 

5. Set up your API Key
   WEATHER_API_KEY=your_api_key_here

6.Run the application
flask run
