#!/bin/zsh
set -euo pipefail

export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

ROOT="/Users/habibullaevnurbek/AKELA GROUP tests/akela-assess"
REMOTE_HOST="${AKELA_SSH_HOST:-akelagro@95.46.96.13}"
REMOTE_APP="domains/edu.akelagroup.uz/app"
STORAGE_ROOT="/home/akelagro/domains/edu.akelagroup.uz/storage"
SSH_PASSWORD="${AKELA_SSH_PASSWORD:-}"

if [ -z "$SSH_PASSWORD" ]; then
  echo "Set AKELA_SSH_PASSWORD before running deploy-edu.sh"
  exit 1
fi

cd "$ROOT"

if [ ! -f .env.local ]; then
  echo "Missing .env.local"
  exit 1
fi

echo ">>> Building production bundle..."
set -a
source .env.local
set +a
npm run build

echo ">>> Assembling deploy folder..."
rm -rf /tmp/akela-edu-deploy
mkdir -p /tmp/akela-edu-deploy
rsync -a .next/standalone/ /tmp/akela-edu-deploy/
mkdir -p /tmp/akela-edu-deploy/.next
rsync -a .next/static /tmp/akela-edu-deploy/.next/
rsync -a public /tmp/akela-edu-deploy/
cp .env.local /tmp/akela-edu-deploy/.env
mkdir -p /tmp/akela-edu-deploy/public

# Production must use Turso — never ship local SQLite flag
sed -i.bak '/^AKELA_USE_LOCAL_DB=/d' /tmp/akela-edu-deploy/.env
sed -i.bak '/^VERCEL_OIDC_TOKEN=/d' /tmp/akela-edu-deploy/.env
rm -f /tmp/akela-edu-deploy/.env.bak

if ! grep -q '^LOCAL_STORAGE_ROOT=' /tmp/akela-edu-deploy/.env; then
  echo "LOCAL_STORAGE_ROOT=$STORAGE_ROOT" >> /tmp/akela-edu-deploy/.env
fi

echo ">>> Upload size: $(du -sh /tmp/akela-edu-deploy | cut -f1)"

if ! command -v expect >/dev/null; then
  echo "expect is required for SSH password auth"
  exit 1
fi

export COPYFILE_DISABLE=1
export DEPLOY_SSH_PASSWORD="$SSH_PASSWORD"
export DEPLOY_REMOTE_HOST="$REMOTE_HOST"

expect << 'EOF'
set timeout 40
set password $env(DEPLOY_SSH_PASSWORD)
set host $env(DEPLOY_REMOTE_HOST)
spawn ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no $host "mkdir -p domains/edu.akelagroup.uz/app domains/edu.akelagroup.uz/storage/{tests,lessons,attestations,design,reports,employees}"
expect "password:"
send "$password\r"
expect eof
EOF

expect << EOF
set timeout 300
set password \$env(DEPLOY_SSH_PASSWORD)
set host \$env(DEPLOY_REMOTE_HOST)
spawn bash -c "tar -C /tmp/akela-edu-deploy --disable-copyfile -czf - . | ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no \$host \"tar -C domains/edu.akelagroup.uz/app -xzf -\""
expect "password:"
send "\$password\r"
expect eof
catch wait result
exit [lindex \$result 3]
EOF

expect << 'EOF'
set timeout 60
set password $env(DEPLOY_SSH_PASSWORD)
set host $env(DEPLOY_REMOTE_HOST)
spawn ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no $host
expect "password:"
send "$password\r"
expect "$ "
send "cloudlinux-selector restart --json --interpreter nodejs --domain edu.akelagroup.uz --app-root /home/akelagro/domains/edu.akelagroup.uz/app; echo RESTART_DONE\r"
expect "RESTART_DONE"
send "exit\r"
expect eof
EOF

echo ">>> Deployed to https://edu.akelagroup.uz"
