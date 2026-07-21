import { Router } from 'express';
import { portalReaderAuth } from '../middleware/portalReaderAuth.js';
import { processPortalAlertFromReader } from '../services/portalIngestService.js';

const router = Router();

/**
 * Webhook invocado por el FX9600 al detectar salida no autorizada.
 * La PC consulta entonces el reporte de tags en el lector (sin polling).
 */
router.post('/alert', portalReaderAuth, async (req, res) => {
  try {
    const hint = req.body ?? {};
    const result = await processPortalAlertFromReader(hint);
    res.json({
      ok: true,
      received: hint,
      ...result,
    });
  } catch (e) {
    console.warn('[Portal] webhook error:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

export default router;
