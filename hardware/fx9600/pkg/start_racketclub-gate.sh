#!/bin/sh
STOP_FLAG="/apps/.racketclub-gate-stopped"
if [ -f "$STOP_FLAG" ]; then
  echo "racketclub-gate detenido por operador ($STOP_FLAG). Use Iniciar app o rm $STOP_FLAG" >&2
  exit 0
fi
cd /apps || exit 1
export PYTHONPATH=/apps
export VERSION=1.0.17-fase2
exec -a racketclub-gate python3 /apps/racketclub_gate.py
