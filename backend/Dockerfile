FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY . .

# The app runs as this unprivileged user. The entrypoint starts as root only to fix
# ownership of the mounted volumes, then drops to it before running anything else.
RUN useradd --uid 10001 --no-create-home --home-dir /app gatepass && \
    mkdir -p /app/staticfiles /app/media && \
    chown -R gatepass:gatepass /app/staticfiles /app/media

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "gatepass.wsgi:application", "-c", "gunicorn.conf.py"]
