#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu VPS for Glosa and the sites that come
# after it (spec 1E §3). Safe to run again. It starts no stack: the owner does
# that by hand (docs/ops/deploy.md).
#
# Usage, from your own sudo user (not root):
#   sudo bash vps-setup.sh "ssh-ed25519 AAAA... github-actions-glosa"
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash vps-setup.sh \"<public key>\"" >&2
  exit 1
fi
deploy_key="${1:?Give the GitHub Actions public key as the first argument}"

echo "==> Docker Engine and the compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> User deploy (for GitHub Actions)"
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
if ! grep -qxF "$deploy_key" /home/deploy/.ssh/authorized_keys; then
  echo "$deploy_key" >> /home/deploy/.ssh/authorized_keys
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> SSH: keys only, no root login"
admin="${SUDO_USER:-}"
if [ -n "$admin" ] && [ "$admin" != "root" ] && [ -s "/home/$admin/.ssh/authorized_keys" ]; then
  cat > /etc/ssh/sshd_config.d/10-glosa.conf <<'EOF'
# Written by vps-setup.sh. Sorts before 50-cloud-init.conf, so it wins.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
  sshd -t
  systemctl reload ssh
else
  echo "    Skipped: run this script with sudo from your own user that logs in with an SSH key," >&2
  echo "    otherwise turning off passwords and root could lock you out." >&2
fi

echo "==> Firewall: only 22, 80 and 443"
apt-get install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Swap 2 GB"
if ! swapon --show | grep -q '^/swapfile'; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

echo "==> Automatic security updates"
apt-get install -y unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

echo "==> Shared Docker network and folders"
docker network inspect web >/dev/null 2>&1 || docker network create web
install -d -o deploy -g deploy /opt/proxy /opt/proxy/sites /opt/glosa-dev /opt/glosa-prod

echo "Done. Next: docs/ops/deploy.md, section 3.4."
