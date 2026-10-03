FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY edge_backend/requirements.txt /app/edge_backend/requirements.txt
RUN pip install --no-cache-dir -r /app/edge_backend/requirements.txt
COPY edge_backend/ /app/edge_backend/
COPY DEPLOYMENT.md /app/DEPLOYMENT.md
COPY --from=frontend /build/frontend/dist /app/frontend/dist
RUN useradd --create-home --uid 10001 rovera && mkdir /app/data && chown rovera:rovera /app/data
USER rovera
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" || exit 1
CMD ["uvicorn","app.main:app","--app-dir","edge_backend","--host","0.0.0.0","--port","8000","--no-proxy-headers"]
