// ─── Estado mapping ──────────────────────────────────────────

const EST_TO_FRONT = { operativo: 'verde', seguimiento: 'amarillo', critico: 'rojo' };
const FRONT_TO_EST = { verde: 'operativo', amarillo: 'seguimiento', rojo: 'critico' };

const toFront = (e) => EST_TO_FRONT[e] || 'verde';
const toDB    = (e) => FRONT_TO_EST[e] || e; // acepta también los valores DB directamente

// ─── Fecha → string DD/MM/YYYY ───────────────────────────────

const fmtFecha = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
};

// ─── Observación canónica ─────────────────────────────────────

const mapObs = (estado, texto) => {
  if (texto) return texto;
  if (estado === 'critico')    return 'Acción en curso';
  if (estado === 'seguimiento') return 'Control programado';
  return 'Sin observaciones';
};

// ─── Indicadores → campos flat ───────────────────────────────

const flatInds = (indicadores, tipos) => {
  const result = {};
  const alias = { aire_ac: 'aire', proyector: 'proy', electricidad: 'elec', filtraciones: 'filt' };
  tipos.forEach(tipo => {
    const ind = indicadores.find(i => i.tipo === tipo);
    const estado = ind ? toFront(ind.estado) : 'verde';
    const key = alias[tipo] || tipo;
    result[key] = estado;
  });
  return result;
};

// ─── Transformadores por entidad ─────────────────────────────

const transformDormitorio = (d) => ({
  id:        d.id,
  nombre:    d.nombre,
  capacidad: d.capacidad,
  ocupacion: d.ocupacion,
  estado:    toFront(d.estado_general),
  revision:  fmtFecha(d.revision_fecha),
  obs:       mapObs(d.estado_general, d.observacion_actual),
  ...flatInds(d.indicadores || [], ['electricidad','aire_ac','filtraciones']),
  camas: (d.camas || []).map(c => ({
    id:     c.numero,
    estado: c.estado === 'fuera_de_servicio' ? 'fuera de servicio' : c.estado,
  })),
});

const transformAula = (a) => ({
  id:         a.id,
  nombre:     a.nombre,
  numero:     a.numero,
  capacidad:  a.capacidad,
  edificio_id:a.edificio_id,
  planta_id:  a.planta_id,
  estado:     toFront(a.estado_general),
  revision:   fmtFecha(a.revision_fecha),
  obs:        mapObs(a.estado_general, a.observacion_actual),
  ...flatInds(a.indicadores || [], ['proyector','tv','pc','electricidad','filtraciones']),
});

const transformEspacio = (e) => ({
  id:      e.id,
  nombre:  e.nombre,
  icon:    e.icono,
  sector:  e.sector,
  estado:  toFront(e.estado_general),
  revision:fmtFecha(e.revision_fecha),
  obs:     mapObs(e.estado_general, e.observacion_actual),
  inds: (e.indicadores || []).map(i => ({
    label:  i.tipo.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    tipo:   i.tipo,
    estado: toFront(i.estado),
  })),
});

const transformArbol = (a) => ({
  id:       a.id,
  nombre:   a.nombre,
  tipo:     a.tipo,
  sector:   a.sector,
  estado:   toFront(a.estado_general),
  revision: fmtFecha(a.revision_fecha),
  obs:      mapObs(a.estado_general, a.observacion_actual),
  ...flatInds(a.indicadores || [], ['salud','riego','poda']),
});

const transformArt = (a) => ({
  id:     a.id,
  legajo: a.legajo,
  nombre: a.nombre_persona,
  motivo: a.motivo,
  estado: toFront(a.estado_general),
  inicio: fmtFecha(a.fecha_inicio),
  alta:   fmtFecha(a.fecha_alta_estimada),
  obs:    mapObs(a.estado_general, a.observacion_actual),
});

const transformHistorial = (h) => ({
  id:             h.id,
  campo:          h.campo,
  accion:         h.accion,
  valor_anterior: h.valor_anterior,
  valor_nuevo:    h.valor_nuevo,
  observacion:    h.observacion,
  fecha:          fmtFecha(h.fecha_cambio) + ' ' + new Date(h.fecha_cambio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  usuario:        h.usuario?.nombre || 'Sistema',
});

module.exports = {
  toFront, toDB, fmtFecha, mapObs,
  transformDormitorio, transformAula, transformEspacio,
  transformArbol, transformArt, transformHistorial,
};
