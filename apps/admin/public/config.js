// Écrasé au démarrage du container Docker (voir docker-entrypoint.sh).
// En dev local, pointe sur l'API locale.
window.ENV = { API_URL: 'http://localhost:3000' }
