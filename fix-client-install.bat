@echo off
echo Clearing npm cache and reinstalling client dependencies...

cd client
npm cache clean --force
echo Cache cleaned.

echo Installing core dependencies...
npm install --no-fund --save react react-dom react-scripts react-router-dom

echo Installing Material UI and Firebase...
npm install --no-fund --save @mui/material @mui/icons-material @emotion/react @emotion/styled firebase

echo All dependencies installed. Starting the application...
npm start
