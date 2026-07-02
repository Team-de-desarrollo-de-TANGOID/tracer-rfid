#!/bin/sh
for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
  f="/proc/$pid/cmdline"
  [ -r "$f" ] || continue
  cmd=$(tr '\0' ' ' < "$f")
  echo "$cmd" | grep -qE 'racketclub_gate\.py|racketclub-gate' || continue
  kill -TERM "$pid" 2>/dev/null
done
sleep 2
for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
  f="/proc/$pid/cmdline"
  [ -r "$f" ] || continue
  cmd=$(tr '\0' ' ' < "$f")
  echo "$cmd" | grep -qE 'racketclub_gate\.py|racketclub-gate' || continue
  kill -KILL "$pid" 2>/dev/null
done
rm -f /tmp/racketclub-gate.lock
