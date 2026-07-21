import { getDb } from '../db.js';
import { countDetecciones, countDeteccionesNoRegistradas, listDetecciones, listDeteccionesPorDia } from './portalEventosService.js';
import {
  startOfDayAppTzSql,
  endOfDayAppTzSql,
  startOfWeekMondayAppTzSql,
  firstDayOfMonthAppTzSql,
  firstDayOfPreviousMonthAppTzSql,
  lastDayOfPreviousMonthAppTzSql,
  addDaysInAppTz,
  formatInstantInAppTz,
} from '../utils/appTimezone.js';

function parseAppTzSql(value) {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const d = new Date(
    `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '12'}:${m[5] ?? '00'}:${m[6] ?? '00'}-03:00`
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveDashboardRange(period, from, to) {
  const now = new Date();
  const p = String(period || 'hoy').toLowerCase();

  if (p === 'personalizado' && from && to) {
    return {
      period: p,
      label: 'Personalizado',
      from: from.includes(' ') ? from : `${from} 00:00:00`,
      to: to.includes(' ') ? to : `${to} 23:59:59`,
    };
  }

  if (p === 'ayer') {
    const y = addDaysInAppTz(now, -1);
    return {
      period: p,
      label: 'Ayer',
      from: startOfDayAppTzSql(y),
      to: endOfDayAppTzSql(y),
    };
  }

  if (p === 'semana') {
    return {
      period: p,
      label: 'Esta semana',
      from: startOfWeekMondayAppTzSql(now),
      to: endOfDayAppTzSql(now),
    };
  }

  if (p === 'mes') {
    return {
      period: p,
      label: 'Este mes',
      from: firstDayOfMonthAppTzSql(now),
      to: endOfDayAppTzSql(now),
    };
  }

  if (p === 'mes_anterior') {
    return {
      period: p,
      label: 'Mes anterior',
      from: firstDayOfPreviousMonthAppTzSql(now),
      to: lastDayOfPreviousMonthAppTzSql(now),
    };
  }

  return {
    period: 'hoy',
    label: 'Hoy',
    from: startOfDayAppTzSql(now),
    to: endOfDayAppTzSql(now),
  };
}

/** Rango del período inmediatamente anterior (para comparación). */
export function resolvePreviousDashboardRange(period, from, to) {
  const now = new Date();
  const p = String(period || 'hoy').toLowerCase();

  if (p === 'personalizado' && from && to) {
    const fromD = parseAppTzSql(from);
    const toD = parseAppTzSql(to);
    if (fromD && toD && toD >= fromD) {
      const durationMs = toD.getTime() - fromD.getTime();
      const prevTo = new Date(fromD.getTime() - 1000);
      const prevFrom = new Date(prevTo.getTime() - durationMs);
      return {
        period: 'personalizado_anterior',
        label: 'Lapso anterior',
        from: formatInstantInAppTz(prevFrom),
        to: formatInstantInAppTz(prevTo),
      };
    }
  }

  if (p === 'hoy') {
    const y = addDaysInAppTz(now, -1);
    return {
      period: 'ayer',
      label: 'Ayer',
      from: startOfDayAppTzSql(y),
      to: endOfDayAppTzSql(y),
    };
  }

  if (p === 'ayer') {
    const y = addDaysInAppTz(now, -2);
    return {
      period: 'anteayer',
      label: 'Anteayer',
      from: startOfDayAppTzSql(y),
      to: endOfDayAppTzSql(y),
    };
  }

  if (p === 'semana') {
    const monday = new Date(startOfWeekMondayAppTzSql(now).replace(' ', 'T') + '-03:00');
    const prevMonday = addDaysInAppTz(monday, -7);
    const prevSunday = addDaysInAppTz(monday, -1);
    return {
      period: 'semana_anterior',
      label: 'Semana anterior',
      from: startOfDayAppTzSql(prevMonday),
      to: endOfDayAppTzSql(prevSunday),
    };
  }

  if (p === 'mes') {
    return resolveDashboardRange('mes_anterior');
  }

  if (p === 'mes_anterior') {
    const firstPrev = firstDayOfPreviousMonthAppTzSql(now);
    const d = new Date(firstPrev.replace(' ', 'T') + '-03:00');
    d.setDate(d.getDate() - 1);
    const firstBefore = firstDayOfPreviousMonthAppTzSql(d);
    const lastBefore = lastDayOfPreviousMonthAppTzSql(d);
    return {
      period: 'mes_anterior_al_anterior',
      label: 'Mes previo al anterior',
      from: firstBefore,
      to: lastBefore,
    };
  }

  const y = addDaysInAppTz(now, -1);
  return {
    period: 'ayer',
    label: 'Ayer',
    from: startOfDayAppTzSql(y),
    to: endOfDayAppTzSql(y),
  };
}

export function getDashboardData({ period, from, to } = {}) {
  const range = resolveDashboardRange(period, from, to);
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) AS n FROM activos').get().n;
  const activas = db
    .prepare(
      `SELECT COUNT(*) AS n FROM activos a
       JOIN estados e ON e.id = a.estado_id WHERE e.es_activo = 1`
    )
    .get().n;

  const porEstado = db
    .prepare(
      `SELECT e.id, e.nombre, e.color, e.es_activo, COUNT(a.id) AS cantidad
       FROM estados e
       LEFT JOIN activos a ON a.estado_id = e.id
       GROUP BY e.id
       ORDER BY e.orden, e.nombre`
    )
    .all()
    .map((row) => ({
      id: row.id,
      nombre: row.nombre,
      color: row.color,
      esActivo: Boolean(row.es_activo),
      cantidad: row.cantidad,
    }));

  const salidasDenegadas = countDetecciones({
    from: range.from,
    to: range.to,
    tipo: 'SALIDA_DENEGADA',
  });

  const prevRange = resolvePreviousDashboardRange(range.period, range.from, range.to);
  const salidasPeriodoAnterior = countDetecciones({
    from: prevRange.from,
    to: prevRange.to,
    tipo: 'SALIDA_DENEGADA',
  });

  const noRegistradas = countDeteccionesNoRegistradas({
    from: range.from,
    to: range.to,
    tipo: 'SALIDA_DENEGADA',
  });

  const porDia = listDeteccionesPorDia({
    from: range.from,
    to: range.to,
    tipo: 'SALIDA_DENEGADA',
  });

  const ultimasDetecciones = listDetecciones({
    from: range.from,
    to: range.to,
    limit: 50,
    tipo: 'SALIDA_DENEGADA',
    incidentsOnly: true,
  });

  return {
    range,
    activos: {
      total,
      activas,
      inactivas: total - activas,
      porEstado,
    },
    portal: {
      salidasDenegadas,
      salidasPeriodoAnterior,
      periodoAnteriorLabel: prevRange.label,
      noRegistradas,
      porDia,
      ultimaDeteccionAt: ultimasDetecciones[0]?.detectadoAt ?? null,
      ultimasDetecciones,
    },
    generatedAt: new Date().toISOString(),
  };
}
