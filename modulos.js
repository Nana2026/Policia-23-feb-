// ─── Espacios ─────────────────────────────────────────────────
const router  = require('express').Router();
const prisma  = require('../db');
const { autenticar, soloAdmin } = require('../middleware/auth');
const { auditarCambios, registrarCambio } = require('../middleware/audit');
const { transformEspacio, transformArbol, transformArt } = require('../utils/transform');
const { buildWhere, buildPagination, sortByPrioridad } = require('../utils/filtros');

// ─────────────────────────────── ESPACIOS

const routerEspacios = require('express').Router();

routerEspacios.get('/', autenticar, async (req, res) => {
  try {
    const where = buildWhere(req.query, ['nombre','sector']);
    const items = await prisma.espacio.findMany({ where, include: { indicadores: true } });
    let data = items.map(transformEspacio);
    data = sortByPrioridad(data);
    res.json({ data, meta: { total: data.length } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerEspacios.get('/:id', autenticar, async (req, res) => {
  try {
    const e = await prisma.espacio.findUnique({ where: { id: Number(req.params.id) }, include: { indicadores: true } });
    if (!e || !e.activo) return res.status(404).json({ error: 'No encontrado' });
    res.json(transformEspacio(e));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerEspacios.patch('/:id', autenticar, async (req, res) => {
  try {
    const id    = Number(req.params.id);
    const antes = await prisma.espacio.findUnique({ where: { id } });
    if (!antes || !antes.activo) return res.status(404).json({ error: 'No encontrado' });

    const { estado_general, observacion_actual, revision_fecha, indicadores, observacion_cambio } = req.body;
    const data = {};
    if (estado_general    !== undefined) data.estado_general    = estado_general;
    if (observacion_actual !== undefined) data.observacion_actual = observacion_actual;
    if (revision_fecha    !== undefined) data.revision_fecha    = new Date(revision_fecha);

    await prisma.espacio.update({ where: { id }, data });

    if (Array.isArray(indicadores)) {
      for (const ind of indicadores) {
        await prisma.espacioIndicador.updateMany({ where: { espacio_id: id, tipo: ind.tipo }, data: { estado: ind.estado } });
      }
    }

    await auditarCambios({ entidad_tipo:'espacio', entidad_id:id, antes, despues:{...antes,...data}, campos:['estado_general','observacion_actual','revision_fecha'], usuario_id:req.user.id, observacion:observacion_cambio });
    const act = await prisma.espacio.findUnique({ where: { id }, include: { indicadores: true } });
    res.json(transformEspacio(act));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerEspacios.delete('/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.espacio.update({ where: { id }, data: { activo: false } });
    await registrarCambio({ entidad_tipo: 'espacio', entidad_id: id, accion: 'deactivate', usuario_id: req.user.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────── ÁRBOLES

const routerArboles = require('express').Router();

routerArboles.get('/', autenticar, async (req, res) => {
  try {
    const where = buildWhere(req.query, ['nombre','tipo','sector']);
    if (req.query.sector) where.sector = req.query.sector;
    const { skip, take, page, limit } = buildPagination(req.query);
    const [total, items] = await Promise.all([
      prisma.arbol.count({ where }),
      prisma.arbol.findMany({ where, include: { indicadores: true }, skip, take }),
    ]);
    let data = items.map(transformArbol);
    data = sortByPrioridad(data);
    res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerArboles.get('/:id', autenticar, async (req, res) => {
  try {
    const a = await prisma.arbol.findUnique({ where: { id: Number(req.params.id) }, include: { indicadores: true } });
    if (!a || !a.activo) return res.status(404).json({ error: 'No encontrado' });
    res.json(transformArbol(a));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerArboles.patch('/:id', autenticar, async (req, res) => {
  try {
    const id    = Number(req.params.id);
    const antes = await prisma.arbol.findUnique({ where: { id } });
    if (!antes || !antes.activo) return res.status(404).json({ error: 'No encontrado' });

    const { estado_general, observacion_actual, revision_fecha, indicadores, observacion_cambio } = req.body;
    const data = {};
    if (estado_general    !== undefined) data.estado_general    = estado_general;
    if (observacion_actual !== undefined) data.observacion_actual = observacion_actual;
    if (revision_fecha    !== undefined) data.revision_fecha    = new Date(revision_fecha);

    await prisma.arbol.update({ where: { id }, data });
    if (Array.isArray(indicadores)) {
      for (const ind of indicadores) {
        await prisma.arbolIndicador.updateMany({ where: { arbol_id: id, tipo: ind.tipo }, data: { estado: ind.estado } });
      }
    }
    await auditarCambios({ entidad_tipo:'arbol', entidad_id:id, antes, despues:{...antes,...data}, campos:['estado_general','observacion_actual','revision_fecha'], usuario_id:req.user.id, observacion:observacion_cambio });
    const act = await prisma.arbol.findUnique({ where: { id }, include: { indicadores: true } });
    res.json(transformArbol(act));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerArboles.delete('/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.arbol.update({ where: { id }, data: { activo: false } });
    await registrarCambio({ entidad_tipo: 'arbol', entidad_id: id, accion: 'deactivate', usuario_id: req.user.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────── ART

const routerArt = require('express').Router();

routerArt.get('/', autenticar, async (req, res) => {
  try {
    const where = buildWhere(req.query, ['nombre_persona','legajo','motivo']);

    // Alta próxima (≤7 días)
    if (req.query.alta_proxima === 'true') {
      const en7 = new Date(); en7.setDate(en7.getDate() + 7);
      where.fecha_alta_estimada = { lte: en7, gte: new Date() };
    }
    // Casos prolongados (>60 días)
    if (req.query.prolongados === 'true') {
      const hace60 = new Date(); hace60.setDate(hace60.getDate() - 60);
      where.fecha_inicio = { lt: hace60 };
    }

    const items = await prisma.artCaso.findMany({ where });
    let data = items.map(transformArt);
    data = sortByPrioridad(data);
    res.json({ data, meta: { total: data.length } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerArt.get('/:id', autenticar, async (req, res) => {
  try {
    const a = await prisma.artCaso.findUnique({ where: { id: Number(req.params.id) } });
    if (!a || !a.activo) return res.status(404).json({ error: 'No encontrado' });
    res.json(transformArt(a));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerArt.patch('/:id', autenticar, async (req, res) => {
  try {
    const id    = Number(req.params.id);
    const antes = await prisma.artCaso.findUnique({ where: { id } });
    if (!antes || !antes.activo) return res.status(404).json({ error: 'No encontrado' });

    const { estado_general, observacion_actual, fecha_alta_estimada, observacion_cambio } = req.body;
    const data = {};
    if (estado_general      !== undefined) data.estado_general      = estado_general;
    if (observacion_actual   !== undefined) data.observacion_actual   = observacion_actual;
    if (fecha_alta_estimada !== undefined) data.fecha_alta_estimada = new Date(fecha_alta_estimada);

    await prisma.artCaso.update({ where: { id }, data });
    await auditarCambios({ entidad_tipo:'art_caso', entidad_id:id, antes, despues:{...antes,...data}, campos:['estado_general','observacion_actual','fecha_alta_estimada'], usuario_id:req.user.id, observacion:observacion_cambio });
    const act = await prisma.artCaso.findUnique({ where: { id } });
    res.json(transformArt(act));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

routerArt.delete('/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.artCaso.update({ where: { id }, data: { activo: false } });
    await registrarCambio({ entidad_tipo: 'art_caso', entidad_id: id, accion: 'deactivate', usuario_id: req.user.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { routerEspacios, routerArboles, routerArt };
