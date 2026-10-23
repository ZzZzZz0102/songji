#!/usr/bin/env bash
# 松溉古镇网站 · Cloudflare Tunnel 保活脚本
# 用法: ./cloudflared-keepalive.sh start|stop|status|keepalive
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CFD="$ROOT/tools/cloudflared/cloudflared"
LOG="$ROOT/tools/cloudflared/keepalive.log"
PID_FILE="$ROOT/tools/cloudflared/cf.pid"
CONFIG="$ROOT/tools/cloudflared/config.yml"
CHECK_URL="${CHECK_URL:-}"   # 例如 https://songgai.example.top

is_running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

start() {
  if is_running; then echo "已在运行 pid $(cat $PID_FILE)"; return 0; fi
  nohup "$CFD" tunnel --config "$CONFIG" run > "$LOG" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 6
  if is_running; then echo "cloudflared 已启动 pid $(cat $PID_FILE)"; else echo "启动失败: $(tail -5 $LOG)"; return 1; fi
}

stop() { if is_running; then kill "$(cat $PID_FILE)" && rm -f "$PID_FILE"; echo 已停止; else echo 未运行; fi; }

status() {
  if is_running; then
    code=$(curl -s -m 10 -o /dev/null -w "%{http_code}" --noproxy '*' "$CHECK_URL" 2>/dev/null || echo 000)
    echo "cloudflared 运行中 pid $(cat $PID_FILE)；$CHECK_URL 响应 HTTP $code"
  else echo "cloudflared 未运行"; fi
}

keepalive() {
  while true; do
    if ! is_running; then
      echo "[$(date '+%F %T')] 进程不在，重启" >> "$LOG"
      nohup "$CFD" tunnel --config "$CONFIG" run >> "$LOG" 2>&1 &
      echo $! > "$PID_FILE"
    elif [ -n "$CHECK_URL" ]; then
      code=$(curl -s -m 8 -o /dev/null -w "%{http_code}" --noproxy '*' "$CHECK_URL" 2>/dev/null || echo 000)
      if [ "$code" != "200" ] && [ "$code" != "302" ] && [ "$code" != "301" ] && [ "$code" != "403" ]; then
        echo "[$(date '+%F %T')] 公网异常 HTTP=$code，重启" >> "$LOG"
        kill "$(cat "$PID_FILE")" 2>/dev/null; sleep 2
        nohup "$CFD" tunnel --config "$CONFIG" run >> "$LOG" 2>&1 &
        echo $! > "$PID_FILE"
      fi
    fi
    sleep 15
  done
}

case "${1:-}" in
  start) start;; stop) stop;; status) status;; keepalive) keepalive;;
  *) echo "用法: $0 start|stop|status|keepalive"; exit 1;;
esac
