const router = require('express').Router();
const prisma = require('../db');
const { autenticar } = require('../middleware/auth');
const { transformHistorial } = require('../utils/transform');

// GET /api/historial?entidad_tipo=aula&entidad_id=1&page=1&limit=20
router.get('/', autenticar, async (req, res) => {
  try {
    const where = {};
    if (req.query.entidad_tipo) where.entidad_tipo = req.query.entidad_tipo;
    if (req.query.entidad_id)   where.entidad_id   = Number(req.query.entidad_id);
    if (req.query.usuario_id)   where.usuario_id   = Number(req.query.usuario_id);

    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));

    const [total, items] = await Promise.all([
      prisma.historialCambio.count({ where }),
      prisma.historialCambio.findMany({
        where,
        include: { usuario: { select: { nombre: true } } },
        orderBy: { fecha_cambio: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      data: items.map(transformHistorial),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/historial/:entidad/:id — historial de una entidad específica
router.get('/:entidad/:id', autenticar, async (req, res) => {
  try {
    const items = await prisma.historialCambio.findMany({
      where: { entidad_tipo: req.params.entidad, entidad_id: Number(req.params.id) },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { fecha_cambio: 'desc' },
      take: 30,
    });
    res.json({ data: items.map(transformHistorial) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
