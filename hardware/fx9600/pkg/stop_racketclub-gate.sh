#!/bin/sh
# Detiene racketclub-gate (no se auto-mata: excluye este script y start_*.sh).
STOP_FLAG="/apps/.racketclub-gate-stopped"
touch "$STOP_FLAG" 2>/dev/null || true

SELF=$$
PARENT=$PPID

is_gate_pid() {
  pid="$1"
  [ "$pid" = "$SELF" ] && return 1
  [ "$pid" = "$PARENT" ] && return 1
  f="/proc/$pid/cmdline"
  [ -r "$f" ] || return 1
  cmd=$(tr '\0' ' ' < "$f")
  # Excluir scripts de control (el bug anterior mataba este mismo script).
  case "$cmd" in
    *stop_racketclub-gate*|*start_racketclub-gate*) return 1 ;;
  esac
  # Solo el proceso Python / launcher de la app.
  echo "$cmd" | grep -qE 'racketclub_gate\.py' && return 0
  # exec -a racketclub-gate python3 ...
  echo "$cmd" | grep -qE '(^|/)racketclub-gate( |$)' && return 0
  return 1
}

list_gate_pids() {
  for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
    is_gate_pid "$pid" || continue
    echo "$pid"
  done
}

kill_gate_pids() {
  sig="$1"
  for pid in $(list_gate_pids); do
    echo "kill -$sig $pid: $(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null)"
    if ! kill "-$sig" "$pid" 2>/tmp/racketclub-kill.err; then
      err=$(cat /tmp/racketclub-kill.err 2>/dev/null)
      echo "  fallo: $err (¿permisos? pruebe como root o desde Zebra Applications)"
    fi
  done
}

pids=$(list_gate_pids)
if [ -z "$pids" ]; then
  echo "No hay procesos racketclub-gate activos."
else
  echo "Deteniendo: $pids"
  kill_gate_pids TERM
  sleep 2
  still=$(list_gate_pids)
  if [ -n "$still" ]; then
    echo "Aún vivos tras TERM, enviando KILL: $still"
    kill_gate_pids KILL
    sleep 1
  fi
fi

if command -v fuser >/dev/null 2>&1; then
  fuser -k 8765/tcp 2>/dev/null || true
fi

# Último recurso: matar quien escuche en 8765 (solo si sigue vivo).
still=$(list_gate_pids)
if [ -n "$still" ] && command -v ss >/dev/null 2>&1; then
  for pid in $(ss -lptn 'sport = :8765' 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p'); do
    [ "$pid" = "$SELF" ] && continue
    echo "kill -KILL $pid (puerto 8765)"
    kill -KILL "$pid" 2>/dev/null || true
  done
fi

rm -f /tmp/racketclub-gate.lock /tmp/racketclub-kill.err

still=$(list_gate_pids)
if [ -n "$still" ]; then
  echo "ERROR: no se pudo detener PID(s): $still"
  echo "El proceso probablemente corre como otro usuario (Zebra). Use Stop en Applications o:"
  echo "  sudo kill -9 $still"
  exit 1
fi

echo "User App detenida. Bandera: $STOP_FLAG"
exit 0
