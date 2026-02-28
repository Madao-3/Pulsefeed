#!/bin/bash
# ============================================
# PulseFeed 🦞 一键部署 / 更新脚本
# 用法: bash scripts/deploy.sh
# ============================================
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)

echo "🦞 PulseFeed Deploy"
echo "   Directory: ${PROJECT_DIR}"
echo ""

# ── 检查 .env ──
if [ ! -f .env ]; then
    echo "❌ .env file not found! Create it first:"
    echo "   cp .env.example .env && nano .env"
    exit 1
fi

# ── 检查 Basic Auth 密码文件 ──
if [ ! -f nginx/.htpasswd ]; then
    echo "🔐 No Basic Auth password set. Creating one now..."
    echo "   Enter a password for the 'admin' user:"
    if command -v htpasswd &> /dev/null; then
        htpasswd -c nginx/.htpasswd admin
    else
        echo "   htpasswd not found, generating with openssl..."
        read -s -p "   Password: " PASSWORD
        echo ""
        echo "admin:$(openssl passwd -apr1 "$PASSWORD")" > nginx/.htpasswd
    fi
    echo "   ✅ Basic Auth configured"
fi

# ── 构建 & 启动 ──
echo ""
echo "🐳 Building and starting containers..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose build --no-cache pulsefeed
docker compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# ── 健康检查 ──
echo "🏥 Health check..."
if curl -sf -o /dev/null http://localhost:3000/api/stats/system 2>/dev/null; then
    echo "   ✅ PulseFeed is running!"
else
    echo "   ⚠️  PulseFeed may still be starting. Check logs:"
    echo "      docker compose logs -f pulsefeed"
fi

echo ""
echo "============================================"
echo "🦞 Deploy complete!"
echo "============================================"
echo ""
echo "Access: http://$(curl -sf ifconfig.me 2>/dev/null || echo '<your-ip>')"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f pulsefeed   # 查看日志"
echo "  docker compose logs -f nginx       # Nginx 日志"
echo "  docker compose restart pulsefeed   # 重启服务"
echo "  docker compose down                # 停止所有"
echo "  docker compose ps                  # 查看状态"
echo ""
