#!/bin/bash

# Test script for the ETL webhook
# Usage: ./test-webhook.sh [webhook_url] [secret]

WEBHOOK_URL="${1:-http://localhost:3001/webhook/events}"
WEBHOOK_SECRET="${2:-}"

echo "Testing webhook at: $WEBHOOK_URL"

# Test health endpoint
echo -e "\n1. Testing health endpoint..."
curl -s "$WEBHOOK_URL/../health" | head -c 500

# Test stats endpoint
echo -e "\n\n2. Testing stats endpoint..."
curl -s "$WEBHOOK_URL/../stats" | head -c 500

# Test event ingestion
echo -e "\n\n3. Sending test event..."

TIMESTAMP=$(date +%s)000

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  ${WEBHOOK_SECRET:+-H "X-Webhook-Secret: $WEBHOOK_SECRET"} \
  -d "{
    \"timestamp\": $TIMESTAMP,
    \"prompt\": \"Explain the concept of cognitive waste in LLM systems\",
    \"response\": \"Cognitive waste refers to inefficient use of LLM resources...\",
    \"inputTokens\": 12,
    \"outputTokens\": 45,
    \"latency\": 850,
    \"model\": \"gpt-4\",
    \"provider\": \"openai\",
    \"configId\": \"test-config-1\",
    \"isAdversarial\": false,
    \"success\": true,
    \"efficiencyRatio\": 3.75,
    \"wasteIndex\": 0.25,
    \"semanticDrift\": 0.15,
    \"hallucinationProb\": 0.05,
    \"censorshipScore\": 0.0,
    \"biasScore\": 0.1,
    \"tokensPerSecond\": 52.9,
    \"costUsd\": 0.0015
  }"

echo -e "\n\n4. Checking updated stats..."
curl -s "$WEBHOOK_URL/../stats" | head -c 500

echo -e "\n\nTest complete!"
