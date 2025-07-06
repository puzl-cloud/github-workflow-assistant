import logging

from sanic import Sanic

from env import *
from src.utils.sanic_utils import catch_signals, register_custom_error_handler
from src.api import health_bp, api_bp, static_bp

logging.basicConfig()
logging.getLogger().setLevel(logging.INFO)


APP_NAME = "github-workflow-assistant"
app = Sanic(APP_NAME)
app.config.API_VERSION = "0.1.1"
app.config.API_TITLE = APP_NAME
app.config.API_PRODUCES_CONTENT_TYPES = ['application/json']

# API routes
app.blueprint(health_bp)
app.blueprint(api_bp)
app.blueprint(static_bp)

# Customize error responses
register_custom_error_handler(app)

# Terminate the app gracefully
app.add_task(catch_signals(app))

# Use keep alive to match Chrome's AJAX requests
app.config.KEEP_ALIVE_TIMEOUT = 180


if __name__ == '__main__':
    ssl = {'cert': SSL_CERT_PATH, 'key': SSL_KEY_PATH} if SSL_CERT_PATH and SSL_KEY_PATH else None
    try:
        logging.info(f"{APP_NAME} started: v{app.config.API_VERSION}", extra={"version": app.config.API_VERSION})
        app.run(host=LISTEN_HOST, port=LISTEN_PORT, ssl=ssl)
    except KeyboardInterrupt:
        logging.info(f"Got KeyboardInterrupt. {APP_NAME} terminated successfully.")
        exit(0)
