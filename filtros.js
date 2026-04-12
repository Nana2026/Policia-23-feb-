/**
 * Construye el objeto `where` de Prisma a partir de query params.
 * Soporta: estado, q (búsqueda), revision_vencida, solo_criticos
 */
function buildWhere(query, camposBusqueda = ['nombre']) {
  const where = { activo: true };

  // Estado
  if (query.estado) {
    const map = { rojo: 'critico', amarillo: 'seguimiento', verde: 'operativo' };
    where.estado_general = map[query.estado] || query.estado;
  }

  // Solo críticos
  if (query.solo_criticos === 'true') {
    where.estado_general = 'critico';
  }

  // Búsqueda texto
  if (query.q) {
    where.OR = camposBusqueda.map(campo => ({
      [campo]: { contains: query.q, mode: 'insensitive' },
    }));
  }

  // Revisión vencida (más de 30 días)
  if (query.revision_vencida === 'true') {
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    where.revision_fecha = { lt: hace30 };
  }

  return where;
}

/**
 * Construye el objeto `orderBy` de Prisma.
 * orden: prioridad | revision | nombre
 */
function buildOrderBy(query) {
  const PRIORIDAD = { critico: 0, seguimiento: 1, operativo: 2 };
  switch (query.orden) {
    case 'revision': return [{ revision_fecha: 'asc' }];
    case 'nombre':   return [{ nombre: 'asc' }];
    default:         return [{ estado_general: 'asc' }, { nombre: 'asc' }];
    // Prisma no ordena por enum nativo en ese orden; usamos asc que da: critico < operativo < seguimiento
    // Para prioridad real se ordena post-fetch o con raw query
  }
}

/**
 * Paginación: devuelve { skip, take, page, limit }
 */
function buildPagination(query) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10)));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

/**
 * Ordena en memoria por prioridad (critico → seguimiento → operativo).
 * Usar cuando Prisma no puede hacer ORDER BY en enum personalizado.
 */
function sortByPrioridad(items, estadoKey = 'estado') {
  const ord = { rojo: 0, amarillo: 1, verde: 2, critico: 0, seguimiento: 1, operativo: 2 };
  return [...items].sort((a, b) => (ord[a[estadoKey]] ?? 9) - (ord[b[estadoKey]] ?? 9));
}

module.exports = { buildWhere, buildOrderBy, buildPagination, sortByPrioridad };
