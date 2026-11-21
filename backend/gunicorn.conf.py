"""Gunicorn settings for the production container."""
import multiprocessing
import os

bind = "0.0.0.0:8000"
workers = int(os.environ.get("GUNICORN_WORKERS", min(4, multiprocessing.cpu_count() * 2 + 1)))
threads = int(os.environ.get("GUNICORN_THREADS", 2))
timeout = 60
graceful_timeout = 30
keepalive = 5
max_requests = 2000
max_requests_jitter = 200
accesslog = "-"
errorlog = "-"
# The bundled Caddy proxy is the only thing that can reach this port.
forwarded_allow_ips = "*"
