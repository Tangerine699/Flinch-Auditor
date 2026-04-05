#!/bin/bash

# Flinch Auditor - Setup Script
echo "🚀 Starting Flinch Auditor Setup..."

# Install Node.js dependencies
echo "📦 Installing npm packages..."
npm install

# Instructions for Chrome Extension
echo "--------------------------------------------------------"
echo "🛠️ Chrome Extension Setup Instructions:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' in the top right corner."
echo "3. Click 'Load unpacked' and select the 'chrome-extension' folder in this project."
echo "4. Flinch Auditor will now monitor ChatGPT, Claude, and Gemini."
echo "--------------------------------------------------------"

# Start the server
echo "🔥 Starting Flinch Auditor Server..."
npm run dev
