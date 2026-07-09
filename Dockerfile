# Serve the static site with nginx. Deterministic deploy on Dokploy / any platform:
# set Build Type = Dockerfile (Build Path "/"). The files are copied into nginx's
# web root explicitly, so it works regardless of publish-directory auto-detection.
FROM nginx:alpine

# SPA-friendly config (falls back to index.html).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the site into nginx's web root (.dockerignore keeps junk out).
COPY . /usr/share/nginx/html

EXPOSE 80
