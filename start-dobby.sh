#!/bin/bash

# Kill any existing node processes (optional - uncomment if needed)
# pkill node

# Start the agent with Dobby character
pnpm start --characters="characters/dobby.character.json" &

# Wait a moment for the agent to initialize
sleep 2

# Start the client
pnpm start:client