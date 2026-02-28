#!/bin/bash
# ============================================
# PulseFeed 🦞 Droplet 初始化脚本
# 在全新的 Ubuntu 22.04/24.04 Droplet 上运行
# 用法: curl -sL <url> | bash
# ============================================
set -euo pipefail

echo "🦞 PulseFeed Droplet Setup Starting..."

# ── 1. 系统更新 ──
echo "📦 Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. 安装 Docker ──
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# ── 3. 安装 Docker Compose plugin ──
echo "🔧 Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi

# ── 4. 安装常用工具 ──
echo "🔧 Installing utilities..."
apt-get install -y -qq git htop apache2-utils

# ── 5. 创建项目目录 ──
echo "📁 Setting up project directory..."
mkdir -p /opt/pulsefeed
cd /opt/pulsefeed

# ── 6. 配置 swap（1GB Droplet 必需） ──
echo "💾 Configuring swap..."
if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "   Swap enabled: 1GB"
fi

# ── 7. 配置防火墙 ──
echo "🔒 Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
fi

# ── 8. 生成 .env 文件 ──
if [ ! -f /opt/pulsefeed/.env ]; then
    echo "🔑 Generating .env file..."
    CONFIG_SECRET=$(openssl rand -hex 32)
    cat > /opt/pulsefeed/.env << EOF
# PulseFeed 配置 — 自动生成于 $(date)
CONFIG_SECRET=${CONFIG_SECRET}

# MCP 服务（如需要）
# TWITTER_API_KEY=
# NEWS_API_KEY=
EOF
    chmod 600 /opt/pulsefeed/.env
    echo "   .env created with random CONFIG_SECRET"
fi

# ── 9. 生成 Basic Auth 密码 ──
echo ""
echo "============================================"
echo "🦞 Droplet setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Clone your repo:  cd /opt/pulsefeed && git clone <your-repo> ."
echo "  2. Set Basic Auth:   htpasswd -c nginx/.htpasswd admin"
echo "  3. Edit .env:        nano /opt/pulsefeed/.env"
echo "  4. Deploy:           bash scripts/deploy.sh"
echo ""
echo "Or use the quick deploy:"
echo "  scp -r ./* root@<droplet-ip>:/opt/pulsefeed/"
echo "  ssh root@<droplet-ip> 'cd /opt/pulsefeed && bash scripts/deploy.sh'"
echo ""
