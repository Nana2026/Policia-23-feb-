const router = require('express').Router();
const prisma = require('../db');
const { autenticar, soloAdmin } = require('../middleware/auth');
const { auditarCambios, registrarCambio } = require('../middleware/audit');
const { transformDormitorio } = require('../utils/transform');
const { buildWhere, buildPagination, sortByPrioridad } = require('../utils/filtros');

const INCLUDE = {
  indicadores: true,
  camas:       { orderBy: { numero: 'asc' } },
};

const CAMPOS_AUDITABLES = ['estado_general','observacion_actual','revision_fecha','capacidad','ocupacion'];

// GET /api/dormitorios
router.get('/', autenticar, async (req, res) => {
  try {
    const where  = buildWhere(req.query, ['nombre']);
    const { skip, take, page, limit } = buildPagination(req.query);

    const [total, items] = await Promise.all([
      prisma.dormitorio.count({ where }),
      prisma.dormitorio.findMany({ where, include: INCLUDE, skip, take }),
    ]);

    let data = items.map(transformDormitorio);
    if (!req.query.orden || req.query.orden === 'prioridad') data = sortByPrioridad(data);

    res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dormitorios/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const d = await prisma.dormitorio.findUnique({
      where: { id: Number(req.params.id) },
      include: INCLUDE,
    });
    if (!d || !d.activo) return res.status(404).json({ error: 'No encontrado' });
    res.json(transformDormitorio(d));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/dormitorios/:id
router.patch('/:id', autenticar, async (req, res) => {
  try {
    const id     = Number(req.params.id);
    const antes  = await prisma.dormitorio.findUnique({ where: { id } });
    if (!antes || !antes.activo) return res.status(404).json({ error: 'No encontrado' });

    const { estado_general, observacion_actual, revision_fecha, capacidad, ocupacion, indicadores, observacion_cambio } = req.body;

    // Actualizar dormitorio principal
    const data = {};
    if (estado_general    !== undefined) data.estado_general    = estado_general;
    if (observacion_actual !== undefined) data.observacion_actual = observacion_actual;
    if (revision_fecha    !== undefined) data.revision_fecha    = new Date(revision_fecha);
    if (capacidad         !== undefined) data.capacidad         = Number(capacidad);
    if (ocupacion         !== undefined) data.ocupacion         = Number(ocupacion);

    const despues = await prisma.dormitorio.update({ where: { id }, data, include: INCLUDE });

    // Actualizar indicadores si se envían
    if (Array.isArray(indicadores)) {
      for (const ind of indicadores) {
        await prisma.dormitorioIndicador.updateMany({
          where: { dormitorio_id: id, tipo: ind.tipo },
          data:  { estado: ind.estado },
        });
      }
    }

    // Auditoría
    await auditarCambios({
      entidad_tipo: 'dormitorio', entidad_id: id,
      antes, despues: { ...antes, ...data },
      campos: CAMPOS_AUDITABLES,
      usuario_id: req.user.id,
      observacion: observacion_cambio,
    });

    const actualizado = await prisma.dormitorio.findUnique({ where: { id }, include: INCLUDE });
    res.json(transformDormitorio(actualizado));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/dormitorios/:id — solo admin, soft delete
router.delete('/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.dormitorio.update({ where: { id }, data: { activo: false } });
    await registrarCambio({ entidad_tipo: 'dormitorio', entidad_id: id, accion: 'deactivate', usuario_id: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
