#!/bin/sh
cd /apps || exit 1
export VERSION=1.0.3-fase1
exec -a racketclub-gate python3 /apps/racketclub_gate.py
