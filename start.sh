#!/bin/bash
# Quick Start Script for cPanel Deployment

echo "🚀 Starting FMD Companies Sales CRM..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please create .env file with required variables."
    echo "📄 See .env.production.template for reference."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Check if dist folder exists
if [ ! -d dist ]; then
    echo "❌ Error: dist folder not found!"
    echo "🔨 Please run 'npm run build' first."
    exit 1
fi

echo "✅ All checks passed!"
echo "🚀 Starting server..."
echo ""

# Start the application
NODE_ENV=production node dist/index.js
