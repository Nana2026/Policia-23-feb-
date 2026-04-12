const prisma = require('../db');

/**
 * Registra un cambio en historial_cambios.
 */
async function registrarCambio({ entidad_tipo, entidad_id, campo, valor_anterior, valor_nuevo, usuario_id, accion, observacion }) {
  try {
    await prisma.historialCambio.create({
      data: {
        entidad_tipo,
        entidad_id: Number(entidad_id),
        accion:     accion || (campo === 'estado_general' ? 'status_change' : 'update'),
        campo,
        valor_anterior: valor_anterior != null ? String(valor_anterior) : null,
        valor_nuevo:    valor_nuevo    != null ? String(valor_nuevo)    : null,
        usuario_id,
        observacion: observacion || null,
      },
    });
  } catch (e) {
    // El historial no debe romper la operación principal
    console.error('[audit] Error registrando historial:', e.message);
  }
}

/**
 * Compara dos objetos y registra los campos que cambiaron.
 * campos: array de nombres de campo a comparar
 */
async function auditarCambios({ entidad_tipo, entidad_id, antes, despues, campos, usuario_id, observacion }) {
  for (const campo of campos) {
    const vAntes  = antes[campo]  != null ? String(antes[campo])  : null;
    const vDespues = despues[campo] != null ? String(despues[campo]) : null;
    if (vAntes !== vDespues) {
      await registrarCambio({
        entidad_tipo,
        entidad_id,
        campo,
        valor_anterior: vAntes,
        valor_nuevo:    vDespues,
        usuario_id,
        observacion,
      });
    }
  }
}

module.exports = { registrarCambio, auditarCambios };
