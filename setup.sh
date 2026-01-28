#!/bin/bash

# AICWD Quick Setup Script
# This script helps set up the AICWD system quickly

set -e

echo "🧠 AICWD - Cognitive Waste Monitoring System"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.11+${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. Optional for local model runner${NC}"
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Step 1: Backend setup
echo "📦 Setting up backend..."
cd backend
npm install
cd ..
echo -e "${GREEN}✅ Backend dependencies installed${NC}"
echo ""

# Step 2: Create .env.local if it doesn't exist
if [ ! -f backend/.env.local ]; then
    echo "🔐 Creating backend/.env.local..."
    cp .env.example backend/.env.local
    echo -e "${YELLOW}⚠️  Please update backend/.env.local with your actual credentials${NC}"
else
    echo -e "${GREEN}✅ backend/.env.local already exists${NC}"
fi
echo ""

# Step 3: Check DBT setup
echo "📊 Checking DBT setup..."
if ! python3 -m pip show dbt-core &> /dev/null; then
    echo "📦 Installing DBT..."
    python3 -m pip install dbt-core dbt-postgres
fi
echo -e "${GREEN}✅ DBT is installed${NC}"
echo ""

# Step 4: Create DBT profiles
if [ ! -f ~/.dbt/profiles.yml ]; then
    echo "📝 Creating DBT profiles..."
    mkdir -p ~/.dbt
    cp .dbt/profiles.yml ~/.dbt/profiles.yml
    echo -e "${YELLOW}⚠️  Please update ~/.dbt/profiles.yml with your database credentials${NC}"
else
    echo -e "${GREEN}✅ DBT profiles already exist${NC}"
fi
echo ""

# Summary
echo "=============================================="
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Update credentials:"
echo "   - Edit backend/.env.local with Convex and Groq keys"
echo "   - Edit ~/.dbt/profiles.yml with database credentials"
echo ""
echo "2. Deploy backend:"
echo "   cd backend && npx convex dev"
echo ""
echo "3. Run Docker model runner (optional):"
echo "   cd docker && docker build -t aicwd-model . && docker run -p 8000:8000 aicwd-model"
echo ""
echo "4. Run DBT (requires PostgreSQL):"
echo "   cd dbt && dbt seed && dbt run"
echo ""
echo "5. Deploy frontend:"
echo "   cd frontend && vercel"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"
echo "=============================================="
