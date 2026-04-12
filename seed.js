const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────

/** Seeded pseudo-random: mismo input → mismo output */
const sr = (s) => { let x = Math.sin(s + 1) * 10000; return x - Math.floor(x); };

const estadoPeso = (v, umbrales = [0.7, 0.85]) => {
  if (v < umbrales[0]) return 'critico';
  if (v < umbrales[1]) return 'seguimiento';
  return 'operativo';
};

const peorEstado = (estados) => {
  if (estados.includes('critico')) return 'critico';
  if (estados.includes('seguimiento')) return 'seguimiento';
  return 'operativo';
};

const formatRevision = (i) => {
  const d = String(((i % 28) + 1)).padStart(2, '0');
  return new Date(`2026-03-${d}T08:00:00Z`);
};

const obs = (estado) => {
  if (estado === 'critico') return 'Acción en curso';
  if (estado === 'seguimiento') return 'Control programado';
  return 'Sin observaciones';
};

// ─── Datos de referencia ──────────────────────────────────────

const TIPOS_ARBOL = ['Plátano', 'Eucalipto', 'Tipa', 'Jacarandá', 'Álamo', 'Pino', 'Fresno'];
const SECTORES_ARBOL = ['Patio Norte', 'Patio Sur', 'Acceso Principal', 'Perímetro Este', 'Perímetro Oeste', 'Jardín Central'];

const EDIFICIOS_DEF = [
  { nombre: 'Asturias',                  codigo: 'asturias',  orden: 1, plantas: [{ nombre: 'Planta Baja', orden: 1, rango: [1,10]  }, { nombre: 'Planta Alta', orden: 2, rango: [11,20] }] },
  { nombre: 'Aulas Modulares Centrales', codigo: 'modulares', orden: 2, plantas: [{ nombre: 'Planta Baja', orden: 1, rango: [21,30] }, { nombre: 'Planta Alta', orden: 2, rango: [31,40] }] },
  { nombre: 'Aulas sobre Comedor',       codigo: 'comedor',   orden: 3, plantas: [{ nombre: 'Planta Baja', orden: 1, rango: [41,50] }] },
  { nombre: 'Puesto 1',                  codigo: 'puesto1',   orden: 4, plantas: [{ nombre: 'Planta Baja', orden: 1, rango: [51,60] }, { nombre: 'Planta Alta', orden: 2, rango: [61,70] }] },
  { nombre: 'Puesto 2',                  codigo: 'puesto2',   orden: 5, plantas: [{ nombre: 'Planta Baja', orden: 1, rango: [71,80] }, { nombre: 'Planta Alta', orden: 2, rango: [81,90] }] },
  { nombre: 'Aulas Externas',            codigo: 'externas',  orden: 6, plantas: [{ nombre: 'Planta Baja', orden: 1, rango: [91,100] }] },
];

const ESPACIOS_DEF = [
  { nombre: 'Polideportivo',        icono: '🏀', sector: 'Deportes',   inds: [['electricidad',[.1,.25]],['iluminacion',[.15,.3]],['piso',[.2,.4]],['filtraciones',[.1,.2]],['equipamiento',[.15,.35]]] },
  { nombre: 'SUM',                  icono: '🎭', sector: 'Eventos',    inds: [['electricidad',[.1,.25]],['aire_ac',[.15,.3]],['iluminacion',[.1,.2]],['audiovisual',[.2,.4]],['mobiliario',[.1,.25]]] },
  { nombre: 'Incorporaciones',      icono: '📋', sector: 'Admisión',   inds: [['electricidad',[.1,.2]],['iluminacion',[.1,.2]],['equipamiento',[.15,.3]],['climatizacion',[.2,.4]]] },
  { nombre: 'Baños PB H',           icono: '🚻', sector: 'Sanitarios', inds: [['agua_caliente',[.15,.3]],['plomeria',[.1,.25]],['iluminacion',[.1,.2]],['ventilacion',[.15,.3]]] },
  { nombre: 'Baños PB M',           icono: '🚻', sector: 'Sanitarios', inds: [['agua_caliente',[.12,.28]],['plomeria',[.15,.3]],['iluminacion',[.1,.2]],['ventilacion',[.2,.35]]] },
  { nombre: 'Baños PA H',           icono: '🚻', sector: 'Sanitarios', inds: [['agua_caliente',[.2,.35]],['plomeria',[.1,.2]],['iluminacion',[.1,.25]],['ventilacion',[.12,.28]]] },
  { nombre: 'Baños PA M',           icono: '🚻', sector: 'Sanitarios', inds: [['agua_caliente',[.1,.2]],['plomeria',[.2,.4]],['iluminacion',[.15,.3]],['ventilacion',[.1,.2]]] },
  { nombre: 'Vest. Masculino',      icono: '👕', sector: 'Sanitarios', inds: [['agua_caliente',[.15,.3]],['plomeria',[.1,.25]],['casilleros',[.2,.4]],['iluminacion',[.1,.2]]] },
  { nombre: 'Vest. Femenino',       icono: '👗', sector: 'Sanitarios', inds: [['agua_caliente',[.1,.2]],['plomeria',[.15,.3]],['casilleros',[.2,.35]],['iluminacion',[.1,.25]]] },
  { nombre: 'Edif. Administración', icono: '🏢', sector: 'Edificios',  inds: [['electricidad',[.1,.2]],['internet_red',[.15,.3]],['aire_ac',[.2,.4]],['iluminacion',[.1,.2]],['equipamiento',[.15,.3]]] },
  { nombre: 'Polígono',             icono: '🎯', sector: 'Deportes',   inds: [['iluminacion',[.15,.3]],['blancos',[.2,.4]],['estado_suelo',[.1,.25]],['seguridad',[.1,.2]]] },
  { nombre: 'Edif. Ed. Física',     icono: '🏋️', sector: 'Deportes',   inds: [['electricidad',[.1,.2]],['iluminacion',[.15,.3]],['equipamiento',[.2,.4]],['filtraciones',[.1,.2]]] },
  { nombre: 'Comedor',              icono: '🍽️', sector: 'Servicios',  inds: [['electricidad',[.1,.2]],['gas',[.15,.3]],['equip_cocina',[.2,.4]],['ventilacion',[.1,.25]],['higiene',[.15,.3]]] },
];

// ─── Main seed ────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // ── Roles ──
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: 'admin' },
    update: {},
    create: { nombre: 'admin', descripcion: 'Acceso total al sistema' },
  });
  const rolOperador = await prisma.rol.upsert({
    where: { nombre: 'operador' },
    update: {},
    create: { nombre: 'operador', descripcion: 'Acceso operativo limitado' },
  });
  console.log('✓ Roles creados');

  // ── Usuarios ──
  const hash = (p) => bcrypt.hashSync(p, 10);
  await prisma.usuario.upsert({ where: { email: 'admin@issp.edu.ar'    }, update: {}, create: { nombre: 'Admin Sistema',    email: 'admin@issp.edu.ar',    password_hash: hash('Admin2026!'),    rol_id: rolAdmin.id    } });
  await prisma.usuario.upsert({ where: { email: 'garcia@issp.edu.ar'   }, update: {}, create: { nombre: 'García, Luis',     email: 'garcia@issp.edu.ar',   password_hash: hash('Operador2026!'), rol_id: rolOperador.id } });
  await prisma.usuario.upsert({ where: { email: 'martinez@issp.edu.ar' }, update: {}, create: { nombre: 'Martínez, Paula',  email: 'martinez@issp.edu.ar', password_hash: hash('Operador2026!'), rol_id: rolOperador.id } });
  console.log('✓ Usuarios creados  (admin@issp.edu.ar / Admin2026!)');

  // ── Dormitorios ──
  for (let i = 1; i <= 20; i++) {
    const s = i * 13;
    const cap = 20 + Math.floor(sr(s) * 10);
    const elecE = estadoPeso(sr(s+3), [0.12, 0.28]);
    const aireE = estadoPeso(sr(s+4), [0.18, 0.35]);
    const filtE = estadoPeso(sr(s+5), [0.12, 0.25]);
    const general = peorEstado([elecE, aireE, filtE]);

    const d = await prisma.dormitorio.upsert({
      where: { id: i },
      update: {},
      create: {
        id: i,
        nombre: `Dormi ${i}`,
        capacidad: cap,
        ocupacion: Math.floor(sr(s+1) * cap * 0.85),
        estado_general: general,
        revision_fecha: formatRevision(i),
        observacion_actual: obs(general),
      },
    });

    // Indicadores
    for (const [tipo, estado] of [['electricidad', elecE], ['aire_ac', aireE], ['filtraciones', filtE]]) {
      await prisma.dormitorioIndicador.upsert({
        where: { id: (i - 1) * 3 + ['electricidad','aire_ac','filtraciones'].indexOf(tipo) + 1 },
        update: { estado },
        create: { dormitorio_id: d.id, tipo, estado },
      });
    }

    // Camas
    for (let j = 1; j <= cap; j++) {
      const camaE = sr(j*7+s) > 0.88 ? 'fuera_de_servicio' : sr(j*7+s+1) > 0.92 ? 'mantenimiento' : 'operativa';
      await prisma.cama.upsert({
        where: { dormitorio_id_numero: { dormitorio_id: d.id, numero: j } },
        update: {},
        create: { dormitorio_id: d.id, numero: j, estado: camaE },
      });
    }
  }
  console.log('✓ Dormitorios creados (20)');

  // ── Edificios, plantas, aulas ──
  let aulaId = 1;
  for (const [ei, edDef] of EDIFICIOS_DEF.entries()) {
    const ed = await prisma.edificio.upsert({
      where: { codigo: edDef.codigo },
      update: {},
      create: { nombre: edDef.nombre, codigo: edDef.codigo, orden: edDef.orden },
    });

    for (const [pi, plDef] of edDef.plantas.entries()) {
      const pl = await prisma.planta.upsert({
        where: { id: ei * 2 + pi + 1 },
        update: {},
        create: { edificio_id: ed.id, nombre: plDef.nombre, orden: plDef.orden },
      });

      const [from, to] = plDef.rango;
      for (let num = from; num <= to; num++) {
        const s = (num - 1) * 17 + 1000;
        const proyE = estadoPeso(sr(s+3), [0.15, 0.3]);
        const tvE   = estadoPeso(sr(s+4), [0.2,  0.35]);
        const pcE   = estadoPeso(sr(s+5), [0.18, 0.38]);
        const elecE = estadoPeso(sr(s+6), [0.1,  0.2]);
        const filtE = estadoPeso(sr(s+7), [0.1,  0.2]);
        const general = peorEstado([proyE, tvE, pcE, elecE, filtE]);

        const aula = await prisma.aula.upsert({
          where: { numero: num },
          update: {},
          create: {
            id: num,
            nombre: `Aula ${String(num).padStart(3,'0')}`,
            numero: num,
            edificio_id: ed.id,
            planta_id: pl.id,
            capacidad: 30 + Math.floor(sr(s) * 20),
            estado_general: general,
            revision_fecha: formatRevision(num),
            observacion_actual: obs(general),
          },
        });

        for (const [tipo, estado] of [['proyector', proyE],['tv', tvE],['pc', pcE],['electricidad', elecE],['filtraciones', filtE]]) {
          await prisma.aulaIndicador.upsert({
            where: { aula_id_tipo: { aula_id: aula.id, tipo } },
            update: { estado },
            create: { aula_id: aula.id, tipo, estado },
          });
        }
        aulaId++;
      }
    }
  }
  console.log('✓ Edificios, plantas y aulas creados (100 aulas)');

  // ── Espacios ──
  for (const [i, esp] of ESPACIOS_DEF.entries()) {
    const s = (i + 20) * 10 + 200;
    const indEstados = esp.inds.map(([tipo, t], j) => [tipo, estadoPeso(sr(s + j * 3 + 1), t)]);
    const general = peorEstado(indEstados.map(([,e]) => e));

    const espRec = await prisma.espacio.upsert({
      where: { id: i + 1 },
      update: {},
      create: {
        id: i + 1,
        nombre: esp.nombre,
        icono: esp.icono,
        sector: esp.sector,
        estado_general: general,
        revision_fecha: formatRevision(i + 1),
        observacion_actual: obs(general),
      },
    });

    for (const [tipo, estado] of indEstados) {
      await prisma.espacioIndicador.upsert({
        where: { espacio_id_tipo: { espacio_id: espRec.id, tipo } },
        update: { estado },
        create: { espacio_id: espRec.id, tipo, estado },
      });
    }
  }
  console.log('✓ Espacios creados (13)');

  // ── Árboles ──
  for (let i = 1; i <= 70; i++) {
    const s = (i - 1) * 11 + 3000;
    const saludE = estadoPeso(sr(s+1), [0.15, 0.3]);
    const riegoE = estadoPeso(sr(s+2), [0.12, 0.25]);
    const podaE  = estadoPeso(sr(s+3), [0.2,  0.4]);
    const general = peorEstado([saludE, riegoE, podaE]);

    const arbol = await prisma.arbol.upsert({
      where: { id: i },
      update: {},
      create: {
        id: i,
        nombre: `Árbol ${i}`,
        tipo: TIPOS_ARBOL[Math.floor(sr(s) * 7)],
        sector: SECTORES_ARBOL[Math.floor(sr(s+4) * 6)],
        estado_general: general,
        revision_fecha: formatRevision(i),
        observacion_actual: obs(general),
      },
    });

    for (const [tipo, estado] of [['salud', saludE],['riego', riegoE],['poda', podaE]]) {
      await prisma.arbolIndicador.upsert({
        where: { arbol_id_tipo: { arbol_id: arbol.id, tipo } },
        update: { estado },
        create: { arbol_id: arbol.id, tipo, estado },
      });
    }
  }
  console.log('✓ Árboles creados (70)');

  // ── ART ──
  const artData = [
    { legajo:'2024-001', nombre:'García, Juan M.',     motivo:'Fractura muñeca',     estado:'critico',    inicio:'2026-02-15', alta:'2026-04-20' },
    { legajo:'2024-002', nombre:'Pérez, María L.',     motivo:'Esguince tobillo',    estado:'seguimiento',inicio:'2026-03-01', alta:'2026-04-15' },
    { legajo:'2024-003', nombre:'López, Carlos A.',    motivo:'Lumbalgia',           estado:'operativo',  inicio:'2026-03-10', alta:'2026-04-10' },
    { legajo:'2024-004', nombre:'Martínez, Ana P.',    motivo:'Contusión rodilla',   estado:'seguimiento',inicio:'2026-03-20', alta:'2026-04-25' },
    { legajo:'2024-005', nombre:'González, Luis E.',   motivo:'Tendinitis hombro',   estado:'operativo',  inicio:'2026-03-25', alta:'2026-04-14' },
    { legajo:'2024-006', nombre:'Rodríguez, Sandra B.',motivo:'Fractura tobillo',    estado:'critico',    inicio:'2026-02-01', alta:'2026-04-30' },
    { legajo:'2024-007', nombre:'Fernández, Pablo H.', motivo:'Esguince muñeca',     estado:'operativo',  inicio:'2026-03-28', alta:'2026-04-12' },
    { legajo:'2024-008', nombre:'Torres, Laura M.',    motivo:'Contusión hombro',    estado:'seguimiento',inicio:'2026-03-05', alta:'2026-04-20' },
    { legajo:'2024-009', nombre:'Sosa, Ricardo J.',    motivo:'Lumbalgia aguda',     estado:'critico',    inicio:'2026-02-18', alta:'2026-05-05' },
    { legajo:'2024-010', nombre:'Acosta, Valeria N.',  motivo:'Esguince rodilla',    estado:'seguimiento',inicio:'2026-04-02', alta:'2026-05-01' },
  ];
  for (const [i, a] of artData.entries()) {
    await prisma.artCaso.upsert({
      where: { legajo: a.legajo },
      update: {},
      create: {
        id: i + 1,
        legajo: a.legajo,
        nombre_persona: a.nombre,
        motivo: a.motivo,
        estado_general: a.estado,
        fecha_inicio: new Date(a.inicio),
        fecha_alta_estimada: new Date(a.alta),
        observacion_actual: obs(a.estado),
      },
    });
  }
  console.log('✓ ART creados (10)');

  console.log('\n✅ Seed completado exitosamente');
  console.log('─────────────────────────────────────────');
  console.log('  Usuario admin:    admin@issp.edu.ar  /  Admin2026!');
  console.log('  Usuario operador: garcia@issp.edu.ar /  Operador2026!');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
