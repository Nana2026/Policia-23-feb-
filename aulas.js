const router = require('express').Router();
const prisma = require('../db');
const { autenticar, soloAdmin } = require('../middleware/auth');
const { auditarCambios, registrarCambio } = require('../middleware/audit');
const { transformAula } = require('../utils/transform');
const { buildWhere, buildPagination, sortByPrioridad } = require('../utils/filtros');

const INCLUDE = { indicadores: true, edificio: true, planta: true };
const CAMPOS_AUDITABLES = ['estado_general','observacion_actual','revision_fecha','capacidad'];

// GET /api/aulas
router.get('/', autenticar, async (req, res) => {
  try {
    const where = buildWhere(req.query, ['nombre']);
    // Filtro por edificio
    if (req.query.edificio_id) where.edificio_id = Number(req.query.edificio_id);
    if (req.query.planta_id)   where.planta_id   = Number(req.query.planta_id);

    // Alta próxima no aplica para aulas, pero alta_vencida sí como alias de revision_vencida
    const { skip, take, page, limit } = buildPagination(req.query);

    const [total, items] = await Promise.all([
      prisma.aula.count({ where }),
      prisma.aula.findMany({ where, include: INCLUDE, skip, take, orderBy: { numero: 'asc' } }),
    ]);

    let data = items.map(transformAula);
    if (!req.query.orden || req.query.orden === 'prioridad') data = sortByPrioridad(data);

    res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/aulas/edificios — estructura jerárquica para la grilla
router.get('/edificios', autenticar, async (req, res) => {
  try {
    const edificios = await prisma.edificio.findMany({
      where:   { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        plantas: {
          orderBy: { orden: 'asc' },
          include: {
            aulas: { where: { activo: true }, orderBy: { numero: 'asc' }, include: { indicadores: true } },
          },
        },
      },
    });

    const result = edificios.map(ed => ({
      id:     ed.id,
      nombre: ed.nombre,
      codigo: ed.codigo,
      plantas: ed.plantas.map(pl => ({
        id:     pl.id,
        nombre: pl.nombre,
        ids:    pl.aulas.map(a => a.numero),
      })),
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/aulas/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const a = await prisma.aula.findUnique({
      where: { id: Number(req.params.id) },
      include: INCLUDE,
    });
    if (!a || !a.activo) return res.status(404).json({ error: 'No encontrado' });
    res.json(transformAula(a));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/aulas/:id
router.patch('/:id', autenticar, async (req, res) => {
  try {
    const id    = Number(req.params.id);
    const antes = await prisma.aula.findUnique({ where: { id } });
    if (!antes || !antes.activo) return res.status(404).json({ error: 'No encontrado' });

    const { estado_general, observacion_actual, revision_fecha, capacidad, indicadores, observacion_cambio } = req.body;

    const data = {};
    if (estado_general     !== undefined) data.estado_general    = estado_general;
    if (observacion_actual  !== undefined) data.observacion_actual = observacion_actual;
    if (revision_fecha     !== undefined) data.revision_fecha    = new Date(revision_fecha);
    if (capacidad          !== undefined) data.capacidad         = Number(capacidad);

    await prisma.aula.update({ where: { id }, data });

    if (Array.isArray(indicadores)) {
      for (const ind of indicadores) {
        await prisma.aulaIndicador.updateMany({
          where: { aula_id: id, tipo: ind.tipo },
          data:  { estado: ind.estado },
        });
      }
    }

    await auditarCambios({
      entidad_tipo: 'aula', entidad_id: id,
      antes, despues: { ...antes, ...data },
      campos: CAMPOS_AUDITABLES,
      usuario_id: req.user.id, observacion: observacion_cambio,
    });

    const actualizado = await prisma.aula.findUnique({ where: { id }, include: INCLUDE });
    res.json(transformAula(actualizado));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/aulas/:id — solo admin
router.delete('/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.aula.update({ where: { id }, data: { activo: false } });
    await registrarCambio({ entidad_tipo: 'aula', entidad_id: id, accion: 'deactivate', usuario_id: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
