#!/bin/sh

# Generate config.js
cat <<EOF > /usr/share/nginx/html/config.js
window.config = {
  VITE_GOOGLE_CLIENT_ID: "${VITE_GOOGLE_CLIENT_ID}",
  VITE_GOOGLE_API_KEY: "${VITE_GOOGLE_API_KEY}",
  VITE_SPREADSHEET_ID: "${VITE_SPREADSHEET_ID}"
};
EOF

# Startup nginx
exec "$@"
