#!/bin/bash

# Database Setup Script for Company Directory
# This script sets up the database schema and generates Prisma client

set -e

echo "🚀 Setting up Company Directory database..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not available. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL environment variable is not set."
    echo "📋 Please copy .env.example to .env and configure your database connection:"
    echo "   cp .env.example .env"
    echo "   # Edit .env with your database credentials"
    echo ""
    echo "🔗 Example DATABASE_URL:"
    echo "   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/company_directory?schema=public&connection_limit=20&pool_timeout=20"
    exit 1
fi

# Test database connection
echo "🔍 Testing database connection..."
npm run test:db

# Run database migrations
echo "📊 Running database migrations..."
npm run prisma:migrate

# Verify database schema
echo "✅ Verifying database schema..."
npm run verify:schema

# Test audit and analytics functionality
echo "🔐 Testing audit and analytics..."
npm run test:audit

echo ""
echo "🎉 Database setup completed successfully!"
echo ""
echo "📚 Available commands:"
echo "   npm run dev              - Start development server"
echo "   npm run prisma:studio    - Open Prisma Studio"
echo "   npm run test:db          - Test database connection"
echo "   npm run verify:schema    - Verify database schema"
echo "   npm run test:audit       - Test audit functionality"
echo ""
echo "🔧 Database is ready for development!"