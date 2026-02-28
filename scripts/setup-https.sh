#!/bin/bash
# ============================================
# PulseFeed 🦞 HTTPS 配置脚本
# 用法: bash scripts/setup-https.sh your-domain.com
# ============================================
set -euo pipefail

DOMAIN=${1:-}

if [ -z "$DOMAIN" ]; then
    echo "Usage: bash scripts/setup-https.sh your-domain.com"
    exit 1
fi

cd "$(dirname "$0")/.."

echo "🔒 Setting up HTTPS for ${DOMAIN}..."

# ── 1. 获取证书 ──
echo "📜 Requesting Let's Encrypt certificate..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d "$DOMAIN" \
    --email "admin@${DOMAIN}" \
    --agree-tos \
    --no-eff-email

# ── 2. 更新 nginx.conf ──
echo "🔧 Updating Nginx config for HTTPS..."
sed -i "s/your-domain.com/${DOMAIN}/g" nginx/nginx.conf

# 取消注释 HTTPS server block
# 用户需要手动取消 nginx.conf 中 HTTPS 部分的注释
echo ""
echo "⚠️  Please manually edit nginx/nginx.conf:"
echo "   1. Uncomment the HTTPS server block"
echo "   2. Uncomment the HTTP → HTTPS redirect"
echo "   3. Comment out the current HTTP server block"
echo ""
echo "Then restart:"
echo "   docker compose restart nginx"
echo ""
echo "Auto-renewal is configured via the certbot container."
echo "To enable it: docker compose --profile https up -d certbot"
