#!/bin/bash

# Kill any existing node processes (optional - uncomment if needed)
# pkill node

# Start the agent with Steve Jobs character
pnpm start --characters="characters/steve_jobs.character.json" &

# Wait a moment for the agent to initialize
sleep 2

# Start the client
pnpm start:client