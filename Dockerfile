FROM node:22.23.1-bookworm-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --no-cache-dir -r backend/requirements.txt
COPY backend/nightlight/ ./backend/nightlight/
COPY --from=frontend-build /build/frontend/dist/ ./frontend/dist/
USER 10001:10001
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "nightlight.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
