const router = require('express').Router();
const prisma = require('../db');
const { autenticar } = require('../middleware/auth');
const { transformDormitorio, transformAula, transformEspacio, transformArbol, transformArt } = require('../utils/transform');

// GET /api/dashboard/resumen
router.get('/resumen', autenticar, async (req, res) => {
  try {
    const [dormis, aulas, espacios, arboles, art] = await Promise.all([
      prisma.dormitorio.findMany({ where: { activo: true }, select: { estado_general: true } }),
      prisma.aula.findMany(      { where: { activo: true }, select: { estado_general: true } }),
      prisma.espacio.findMany(   { where: { activo: true }, select: { estado_general: true } }),
      prisma.arbol.findMany(     { where: { activo: true }, select: { estado_general: true } }),
      prisma.artCaso.findMany(   { where: { activo: true }, select: { estado_general: true } }),
    ]);

    const resumen = (arr) => ({
      total:       arr.length,
      criticos:    arr.filter(x => x.estado_general === 'critico').length,
      seguimiento: arr.filter(x => x.estado_general === 'seguimiento').length,
      operativos:  arr.filter(x => x.estado_general === 'operativo').length,
    });

    res.json({
      dormitorios: resumen(dormis),
      aulas:       resumen(aulas),
      espacios:    resumen(espacios),
      arboles:     resumen(arboles),
      art:         resumen(art),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/prioridades
router.get('/prioridades', autenticar, async (req, res) => {
  try {
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
    const hace60 = new Date(); hace60.setDate(hace60.getDate() - 60);
    const en7    = new Date(); en7.setDate(en7.getDate() + 7);

    const [
      aulasCriticas,
      dormisRevVenc,
      artProlongados,
      artAltaProxima,
    ] = await Promise.all([
      prisma.aula.count({ where: { activo: true, estado_general: 'critico' } }),
      prisma.dormitorio.count({ where: { activo: true, estado_general: 'critico', revision_fecha: { lt: hace30 } } }),
      prisma.artCaso.count({ where: { activo: true, fecha_inicio: { lt: hace60 } } }),
      prisma.artCaso.count({ where: { activo: true, fecha_alta_estimada: { lte: en7, gte: new Date() } } }),
    ]);

    const prioridades = [];
    if (aulasCriticas > 0)    prioridades.push({ tipo: 'aulas_criticas',   txt: `${aulasCriticas} aula${aulasCriticas !== 1 ? 's' : ''} en estado crítico`,       e: 'rojo',  moduloId: 'aulas',   filtroAuto: 'rojo' });
    if (dormisRevVenc > 0)    prioridades.push({ tipo: 'dormis_rev_venc',  txt: `${dormisRevVenc} dormitorio${dormisRevVenc !== 1 ? 's' : ''} con revisión vencida`, e: 'rojo',  moduloId: 'dormis',  filtroAuto: 'rojo' });
    if (artProlongados > 0)   prioridades.push({ tipo: 'art_prolongados',  txt: `${artProlongados} caso${artProlongados !== 1 ? 's' : ''} ART con más de 60 días`,  e: 'amber', moduloId: 'art',     filtroAuto: 'rojo' });
    if (artAltaProxima > 0)   prioridades.push({ tipo: 'art_alta_proxima', txt: `${artAltaProxima} alta${artAltaProxima !== 1 ? 's' : ''} estimada${artAltaProxima !== 1 ? 's' : ''} esta semana`, e: 'verde', moduloId: 'art', filtroAuto: 'verde' });

    res.json({ prioridades });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/criticos — incidencias críticas recientes para el resumen
router.get('/criticos', autenticar, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10');

    const [dormis, aulas, espacios, art] = await Promise.all([
      prisma.dormitorio.findMany({ where: { activo: true, estado_general: 'critico' }, take: 3, select: { id: true, nombre: true, revision_fecha: true } }),
      prisma.aula.findMany(      { where: { activo: true, estado_general: 'critico' }, take: 5, select: { id: true, nombre: true, revision_fecha: true } }),
      prisma.espacio.findMany(   { where: { activo: true, estado_general: 'critico' },           select: { id: true, nombre: true, revision_fecha: true } }),
      prisma.artCaso.findMany(   { where: { activo: true, estado_general: 'critico' },           select: { id: true, nombre_persona: true, fecha_inicio: true } }),
    ]);

    const { fmtFecha } = require('../utils/transform');
    const criticos = [
      ...dormis.map(d  => ({ id: d.id,   nombre: d.nombre,         modulo: 'dormis',   moduloLabel: 'Dormitorios', fecha: fmtFecha(d.revision_fecha) })),
      ...aulas.map(a   => ({ id: a.id,   nombre: a.nombre,         modulo: 'aulas',    moduloLabel: 'Aulas',        fecha: fmtFecha(a.revision_fecha) })),
      ...espacios.map(e => ({ id: e.id,  nombre: e.nombre,         modulo: 'espacios', moduloLabel: 'Espacios',     fecha: fmtFecha(e.revision_fecha) })),
      ...art.map(a     => ({ id: a.id,   nombre: a.nombre_persona, modulo: 'art',      moduloLabel: 'ART',          fecha: fmtFecha(a.fecha_inicio)   })),
    ].slice(0, limit);

    res.json({ criticos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
