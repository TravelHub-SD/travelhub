#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# إعداد خادم Oracle Cloud (Ubuntu ARM/x86) لتشغيل موصّل TravelHub.
# يُشغَّل مرة واحدة على الخادم:  bash oracle-setup.sh
# ─────────────────────────────────────────────────────────────
set -e

echo "== 1) تحديث النظام وتثبيت Docker =="
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
fi
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER" || true

echo "== 2) فتح المنفذ 8080 في جدار حماية الخادم (Ubuntu iptables) =="
# صور Oracle Ubuntu تحجب كل المنافذ افتراضياً — نفتح 8080
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT || true
sudo netfilter-persistent save 2>/dev/null || sudo bash -c 'apt-get install -y iptables-persistent && netfilter-persistent save' || true

echo ""
echo "== تم تثبيت Docker وفتح المنفذ =="
echo "الخطوات التالية:"
echo "  1) انسخ ملف .env.example إلى .env واملأه:   cp .env.example .env && nano .env"
echo "  2) شغّل الموصّل:                              docker compose up -d --build"
echo "  3) تحقّق:                                     curl http://localhost:8080/health"
echo ""
echo "⚠️ لا تنسَ فتح المنفذ 8080 في Oracle Console → Security List (Ingress) أيضاً."
