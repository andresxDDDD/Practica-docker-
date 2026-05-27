#!/bin/bash
set -e

if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

echo "Building Tailwind CSS..."
npx tailwindcss -i ./src/input.css -o ./agenda/static/agenda/css/output.css --minify

echo "Detecting model changes..."
python manage.py makemigrations --noinput

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting server..."
exec gunicorn agendavoz.wsgi:application --bind 0.0.0.0:8000 --workers 3 --reload
