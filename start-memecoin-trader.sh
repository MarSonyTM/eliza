#!/bin/bash

# Kill any existing node processes (optional - uncomment if needed)
# pkill node

# Start the agent with Memecoin Trader character
pnpm start --characters="characters/memecoin_trader.character.json" &

# Wait a moment for the agent to initialize
sleep 2

# Start the client
pnpm start:client