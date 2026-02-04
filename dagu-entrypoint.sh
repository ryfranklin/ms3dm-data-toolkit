#!/bin/bash
# Install curl and jq for DAG scripts (Ubuntu/Debian)
apt-get update && apt-get install -y curl jq

# Start Dagu
exec dagu start-all
