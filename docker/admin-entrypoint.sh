#!/bin/sh
# Injecte l'URL de l'API au démarrage du container (pas au build)
cat > /usr/share/nginx/html/config.js <<EOF
window.ENV = { API_URL: "${API_URL:-http://localhost:3000}" }
EOF
