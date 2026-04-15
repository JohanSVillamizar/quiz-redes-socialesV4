const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");
const { createServer } = require("http");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.static(path.join(__dirname, "public")));

// ─────────────────────────────────────────────────────────────────────────────
// RONDAS DEL JUEGO
// Tipos:
//   "mcq"      → selección múltiple, un miembro responde por el equipo
//   "sort"     → arrastrar tarjetas para ordenar, un miembro controla
//   "match"    → COLABORATIVO: cada miembro conecta al menos un par en vivo
//   "strategy" → COLABORATIVO: cada miembro "toma" al menos un bloque
//   "vote"     → cada miembro vota individualmente, gana la mayoría
// ─────────────────────────────────────────────────────────────────────────────
const ROUNDS = [
  {
    type: "mcq",
    text: "¿Cuántos segundos tienes para capturar atención antes de que el algoritmo deje de distribuir tu video?",
    options: ["10 segundos", "5 segundos", "3 segundos", "1 segundo"],
    correct: 2,
    points: 100,
    timeLimit: 20,
    explanation: "La regla de los 3 segundos: si el usuario abandona antes, el algoritmo interpreta eso como señal negativa y reduce el alcance del video."
  },
  {
    type: "sort",
    text: "Organicen estos pasos para publicar un Reel en Instagram en el orden correcto",
    items: [
      "Escribe el caption con hashtags",
      "Abre Instagram y toca el botón +",
      "Agrega música y texto al video",
      "Selecciona 'Reel' en las opciones",
      "Graba o sube tu video",
      "Toca 'Compartir'"
    ],
    correctOrder: [1, 3, 4, 2, 0, 5],
    points: 200,
    timeLimit: 45,
    explanation: "El orden correcto: abrir la app → seleccionar Reel → grabar/subir → editar con música y texto → escribir el caption → compartir."
  },
  {
    type: "match",
    text: "Unan cada plataforma con su fortaleza principal — ¡cada integrante conecta al menos un par!",
    pairs: [
      { left: "TikTok",    right: "Descubrimiento masivo y viralidad" },
      { left: "Instagram", right: "Estética visual y Social Commerce" },
      { left: "YouTube",   right: "Autoridad profunda y tutoriales" },
      { left: "LinkedIn",  right: "Networking B2B y reputación profesional" }
    ],
    points: 200,
    timeLimit: 45,
    explanation: "Cada red tiene su superpoder: TikTok para que te descubran, Instagram para mostrar y vender, YouTube para enseñar en profundidad, LinkedIn para conectar con empresas."
  },
  {
    type: "vote",
    text: "Un emprendedor tiene solo 2 horas a la semana para dedicarle a redes. ¿Cuál es la mejor decisión?",
    options: [
      "Publicar todos los días aunque sea contenido sin esfuerzo",
      "Publicar 2 veces por semana con valor y responder comentarios",
      "Invertir todo el tiempo en publicidad pagada",
      "Esperar a tener más tiempo antes de empezar"
    ],
    correct: 1,
    points: 150,
    timeLimit: 35,
    explanation: "La consistencia con calidad supera la frecuencia vacía. 2 publicaciones semanales bien pensadas + interacción construyen más comunidad que publicar a diario sin estrategia."
  },
  {
    type: "strategy",
    text: "Tienen una panadería artesanal en Medellín — cada integrante elige un bloque para armar la estrategia juntos",
    blocks: [
      {
        label: "🎯 Público objetivo",
        options: [
          "Toda Colombia, de todas las edades",
          "Personas en Medellín que valoran lo artesanal, 20-40 años",
          "Restaurantes y hoteles (B2B únicamente)",
          "Turistas extranjeros"
        ],
        correct: 1,
        hint: "Un negocio local debe hablarle primero a su comunidad cercana"
      },
      {
        label: "📱 Red principal",
        options: [
          "LinkedIn — para conectar con empresas",
          "Twitter/X — para conversaciones de tendencia",
          "Instagram + TikTok — visual y alcance local",
          "YouTube — tutoriales de panadería de 30 minutos"
        ],
        correct: 2,
        hint: "Un producto visual como el pan necesita plataformas visuales"
      },
      {
        label: "📸 Tipo de contenido",
        options: [
          "Solo fotos del producto con precio",
          "Detrás de cámara: amasar, hornear, decorar",
          "Memes de panadería sin relación al negocio",
          "Noticias del gremio panadero nacional"
        ],
        correct: 1,
        hint: "La autenticidad genera más confianza que la publicidad directa"
      },
      {
        label: "⏱ Frecuencia",
        options: [
          "Una vez al mes para no saturar",
          "10 veces al día en todas las redes",
          "3-4 veces por semana con contenido de valor",
          "Solo publicar cuando haya descuentos"
        ],
        correct: 2,
        hint: "La consistencia moderada supera tanto la ausencia como el exceso"
      }
    ],
    points: 300,
    timeLimit: 60,
    explanation: "Estrategia ganadora para la panadería: público local específico + plataformas visuales + mostrar el proceso real + frecuencia constante."
  },
  {
    type: "mcq",
    text: "¿Cuál herramienta gratuita permite programar publicaciones y revisar métricas de varias redes desde un solo lugar?",
    options: ["Photoshop", "Metricool", "Google Ads", "Hootsuite Pro"],
    correct: 1,
    points: 100,
    timeLimit: 20,
    explanation: "Metricool tiene plan gratuito robusto para programar y analizar métricas de múltiples redes sociales desde un panel centralizado."
  },
  {
    type: "match",
    text: "Conecten cada error común con su solución — ¡repartan los pares entre el equipo!",
    pairs: [
      { left: "Solo publicas para vender",         right: "Aplica la regla 80/20 de valor" },
      { left: "Copias tendencias sin adaptarlas",  right: "Ponle la identidad de tu marca" },
      { left: "Nunca respondes comentarios",       right: "Las redes son conversaciones" },
      { left: "Estás en todas las redes a la vez", right: "Domina 1 o 2 primero" }
    ],
    points: 200,
    timeLimit: 45,
    explanation: "Cada error tiene un antídoto claro. El denominador común es la falta de estrategia: actuar sin ella es el error más costoso en marketing digital."
  },
  {
    type: "vote",
    text: "Un video llega a 50,000 personas pero nadie compra. ¿Cuál es el problema más probable?",
    options: [
      "El video era demasiado largo",
      "Hubo alcance pero no había un llamado a la acción claro",
      "TikTok no sirve para vender",
      "Necesitas más seguidores antes de poder vender"
    ],
    correct: 1,
    points: 150,
    timeLimit: 35,
    explanation: "El alcance sin conversión casi siempre indica ausencia de CTA. Las redes llevan tráfico, pero el contenido debe decirle al usuario qué hacer después."
  },
  {
    type: "sort",
    text: "Ordenen los pasos para crear un video de TikTok que realmente funcione",
    items: [
      "Publicar y responder comentarios en las primeras horas",
      "Elegir el hook (gancho) para los primeros 3 segundos",
      "Definir qué problema o emoción quieres despertar",
      "Grabar el video con buena luz",
      "Agregar texto, música y subtítulos",
      "Escribir el caption con 3-5 hashtags relevantes"
    ],
    correctOrder: [2, 1, 3, 4, 5, 0],
    points: 200,
    timeLimit: 45,
    explanation: "Primero defines el objetivo → luego el gancho → grabas → editas → caption → publicas y alimentas el algoritmo respondiendo comentarios rápido."
  },
  {
    type: "strategy",
    text: "Ahora tienen una marca de ropa sostenible para jóvenes — repartan los bloques y construyan la estrategia juntos",
    blocks: [
      {
        label: "🎯 Mensaje central",
        options: [
          "Somos los más baratos del mercado",
          "Moda que cuida el planeta sin sacrificar estilo",
          "Ropa de todo tipo para todas las edades",
          "Envíos internacionales en 24 horas"
        ],
        correct: 1,
        hint: "El mensaje debe conectar con los valores del público objetivo"
      },
      {
        label: "📱 Formato estrella",
        options: [
          "Fotos de catálogo estáticas en fondo blanco",
          "Reels mostrando la ropa en contextos reales",
          "Artículos de blog sobre sostenibilidad",
          "Podcasts sobre moda"
        ],
        correct: 1,
        hint: "Los jóvenes quieren verse usando la ropa, no verla como un catálogo"
      },
      {
        label: "🤝 Estrategia de comunidad",
        options: [
          "Ignorar comentarios para parecer exclusivo",
          "Comprar seguidores para crecer rápido",
          "Repostear contenido de clientes usando la ropa (UGC)",
          "Solo publicar en días festivos"
        ],
        correct: 2,
        hint: "El contenido generado por usuarios (UGC) es la forma más auténtica y barata de publicidad"
      },
      {
        label: "📊 Métrica de éxito",
        options: [
          "Número total de seguidores acumulados",
          "Cuántos likes por publicación",
          "Tasa de conversión: visitas que se convierten en compras",
          "Cantidad de comentarios negativos recibidos"
        ],
        correct: 2,
        hint: "Las métricas de vanidad no pagan las facturas; la conversión sí"
      }
    ],
    points: 300,
    timeLimit: 60,
    explanation: "Ropa sostenible joven: mensaje con valores + video en contexto real + comunidad de clientes reales + medir conversión. Esta combinación transforma seguidores en compradores."
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO GLOBAL
// Además de teams y submissions, ahora guardamos workingState:
// el "lienzo compartido" que se construye en tiempo real entre los miembros
// del equipo durante las rondas colaborativas (match y strategy).
// ─────────────────────────────────────────────────────────────────────────────
function freshState() {
  return {
    status: "waiting",
    currentRound: -1,
    teams: {},
    // submissions: respuesta final evaluada { teamId → { answer, correct, earned } }
    submissions: {},
    // workingState: estado colaborativo en progreso { teamId → { ... } }
    // Para match:    { connections: {leftIdx: rightIdx}, lockedBy: {leftIdx: memberName} }
    // Para strategy: { selections: {blockIdx: optionIdx}, blockOwner: {blockIdx: memberName} }
    workingState: {},
    roundStartTime: null,
    roundTimer: null,
  };
}
let game = freshState();

// Mapa de conexiones WS → { role, teamId, memberId }
const conns = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function bcast(data, filter) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (filter && !filter(conns.get(ws))) return;
    ws.send(msg);
  });
}
const toAll  = d => bcast(d);
const toHost = d => bcast(d, c => c?.role === "host");
const toTeam = (tid, d) => bcast(d, c => c?.teamId === tid);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS GENERALES
// ─────────────────────────────────────────────────────────────────────────────
function scoreboard() {
  return Object.values(game.teams)
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ rank: i + 1, name: t.name, score: t.score }));
}

function allSubmitted() {
  const ids = Object.keys(game.teams);
  return ids.length > 0 && ids.every(id => game.submissions[id]);
}

// Devuelve el consenso de votos de un equipo (mayoría simple) o null
function teamConsensus(teamId) {
  const members = Object.values(game.teams[teamId]?.members || {});
  if (!members.length) return null;
  const votes = members.map(m => m.vote).filter(v => v !== null && v !== undefined);
  if (!votes.length) return null;
  const tally = {};
  votes.forEach(v => { tally[v] = (tally[v] || 0) + 1; });
  const majority = Math.ceil(members.length / 2);
  const winner = Object.entries(tally).find(([, c]) => c >= majority);
  return winner ? parseInt(winner[0]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUACIÓN Y PUNTUACIÓN
// ─────────────────────────────────────────────────────────────────────────────

// Evalúa si una respuesta es completamente correcta
function evaluate(round, answer) {
  switch (round.type) {
    case "mcq":
    case "vote":
      return answer === round.correct;
    case "sort":
      if (!Array.isArray(answer) || answer.length !== round.correctOrder.length) return false;
      return answer.every((v, i) => v === round.correctOrder[i]);
    case "match":
      // answer es { "0": rightIdx, "1": rightIdx, ... }
      if (typeof answer !== "object" || answer === null) return false;
      return round.pairs.every((_, i) => parseInt(answer[String(i)]) === i);
    case "strategy":
      if (!Array.isArray(answer) || answer.length !== round.blocks.length) return false;
      return round.blocks.every((b, i) => answer[i] === b.correct);
    default:
      return false;
  }
}

// Calcula puntaje parcial — solo relevante para match y strategy
// donde el equipo puede tener respuestas parcialmente correctas
function computeScore(round, answer, elapsed) {
  let basePoints = 0;

  if (round.type === "match") {
    // Un punto proporcional por cada par correcto conectado
    const connected = Object.entries(answer || {});
    const correct = connected.filter(([li, ri]) => parseInt(ri) === parseInt(li)).length;
    const total = round.pairs.length;
    basePoints = Math.round((correct / total) * round.points);

  } else if (round.type === "strategy") {
    // Un punto proporcional por cada bloque correcto elegido
    const correct = round.blocks.filter((b, i) => answer[i] === b.correct).length;
    const total = round.blocks.length;
    basePoints = Math.round((correct / total) * round.points);

  } else {
    // Para mcq, vote, sort: todo o nada
    basePoints = evaluate(round, answer) ? round.points : 0;
  }

  // Bonus de velocidad solo si la respuesta es completamente correcta
  // (no tiene sentido premiar velocidad en respuestas parciales)
  const speedBonus = evaluate(round, answer)
    ? Math.max(0, Math.floor((1 - elapsed / round.timeLimit) * 60))
    : 0;

  return basePoints + speedBonus;
}

// ─────────────────────────────────────────────────────────────────────────────
// REVELAR RONDA
// Aquí también evaluamos el workingState de los equipos colaborativos
// que no hayan enviado su respuesta todavía (tiempo agotado)
// ─────────────────────────────────────────────────────────────────────────────
function revealRound() {
  if (game.roundTimer) clearTimeout(game.roundTimer);
  if (game.status !== "round") return;
  game.status = "reveal";

  const round = ROUNDS[game.currentRound];
  const elapsed = (Date.now() - game.roundStartTime) / 1000;

  // Para equipos colaborativos (match/strategy) que no finalizaron,
  // evaluamos su workingState parcial ahora que el tiempo se acabó
  if (round.type === "match" || round.type === "strategy") {
    Object.keys(game.teams).forEach(tid => {
      if (game.submissions[tid]) return; // ya tenía respuesta final

      const ws = game.workingState[tid];
      if (!ws) return;

      const answer = round.type === "match"
        ? ws.connections
        : ws.selections;

      const earned = computeScore(round, answer, elapsed);
      game.teams[tid].score += earned;
      game.submissions[tid] = {
        answer,
        correct: evaluate(round, answer),
        earned,
        partial: true,
      };
    });
  }

  toAll({
    type: "reveal",
    round,  // ahora sí enviamos la ronda completa con respuestas correctas
    explanation: round.explanation,
    scoreboard: scoreboard(),
    submissions: game.submissions,
    isLast: game.currentRound === ROUNDS.length - 1,
  });
}

function startRoundTimer(secs) {
  if (game.roundTimer) clearTimeout(game.roundTimer);
  game.roundTimer = setTimeout(revealRound, secs * 1000);
}

// Versión "sanitizada" de la ronda para enviar al cliente durante la ronda activa
// — eliminamos las respuestas correctas para que no hagan trampa
function sanitize(round) {
  return {
    ...round,
    correct: undefined,
    correctOrder: undefined,
    blocks: round.blocks?.map(b => ({ ...b, correct: undefined })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAR WORKING STATE para una ronda colaborativa
// Se llama cuando empieza una ronda de match o strategy
// ─────────────────────────────────────────────────────────────────────────────
function initWorkingState(teamId, round) {
  if (round.type === "match") {
    game.workingState[teamId] = {
      connections: {},  // { leftIdx(str): rightIdx(num) }
      lockedBy: {},     // { leftIdx(str): memberName } — para mostrar en UI quién conectó qué
    };
  } else if (round.type === "strategy") {
    game.workingState[teamId] = {
      selections: {},   // { blockIdx(str): optionIdx(num) }
      blockOwner: {},   // { blockIdx(str): memberName }
    };
  }
}

// Construye el snapshot del estado colaborativo para enviarlo al equipo.
// Incluye también cuántos pares/bloques le "corresponden" a cada miembro
// (la distribución equitativa), para que el cliente sepa qué le toca.
function buildCollabSnapshot(teamId, round) {
  const ws = game.workingState[teamId];
  const members = Object.values(game.teams[teamId].members);
  const memberNames = members.map(m => m.name);
  const n = memberNames.length;

  if (round.type === "match") {
    const totalPairs = round.pairs.length;
    // Repartimos los pares equitativamente en orden:
    // miembro 0 → pares 0..k-1, miembro 1 → pares k..2k-1, etc.
    // Usamos el índice dentro del equipo para asignar
    const perMember = Math.ceil(totalPairs / n);
    const assignments = {}; // memberName → [leftIdx, ...]
    memberNames.forEach((name, mi) => {
      assignments[name] = [];
      for (let p = mi * perMember; p < Math.min((mi + 1) * perMember, totalPairs); p++) {
        assignments[name].push(p);
      }
    });
    return {
      connections: ws.connections,
      lockedBy: ws.lockedBy,
      assignments, // cada miembro sabe qué pares son "suyos"
    };
  }

  if (round.type === "strategy") {
    const totalBlocks = round.blocks.length;
    const perMember = Math.ceil(totalBlocks / n);
    const assignments = {};
    memberNames.forEach((name, mi) => {
      assignments[name] = [];
      for (let b = mi * perMember; b < Math.min((mi + 1) * perMember, totalBlocks); b++) {
        assignments[name].push(b);
      }
    });
    return {
      selections: ws.selections,
      blockOwner: ws.blockOwner,
      assignments,
    };
  }

  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET — MANEJADOR CENTRAL
// ─────────────────────────────────────────────────────────────────────────────
wss.on("connection", ws => {
  conns.set(ws, { role: null });

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const conn = conns.get(ws);

    switch (msg.type) {

      // ── HOST ──────────────────────────────────────────────────────────────
      case "host_connect": {
        conns.set(ws, { role: "host" });
        ws.send(JSON.stringify({
          type: "host_init",
          teams: Object.values(game.teams).map(t => ({
            id: t.id, name: t.name, score: t.score,
            memberCount: Object.keys(t.members).length
          })),
          status: game.status,
          totalRounds: ROUNDS.length,
          currentRound: game.currentRound,
        }));
        break;
      }

      // ── CREAR EQUIPO (primer miembro) ─────────────────────────────────────
      case "join_team": {
        if (game.status !== "waiting") {
          ws.send(JSON.stringify({ type: "error", message: "El juego ya comenzó." })); return;
        }
        const teamName = (msg.name || "").trim().slice(0, 30);
        if (!teamName) { ws.send(JSON.stringify({ type: "error", message: "Escribe el nombre del equipo." })); return; }
        if (Object.values(game.teams).some(t => t.name.toLowerCase() === teamName.toLowerCase())) {
          ws.send(JSON.stringify({ type: "error", message: "Ese nombre ya existe." })); return;
        }
        const teamId = uuidv4();
        const memberName = (msg.memberName || "Miembro").trim().slice(0, 20);
        const memberId = uuidv4();
        game.teams[teamId] = {
          id: teamId, name: teamName, score: 0,
          members: { [memberId]: { id: memberId, name: memberName, vote: null } }
        };
        conns.set(ws, { role: "member", teamId, memberId });
        ws.send(JSON.stringify({ type: "team_created", teamId, teamName, memberId, memberName }));
        toAll({ type: "teams_update", teams: Object.values(game.teams).map(t => ({ name: t.name, score: t.score, memberCount: Object.keys(t.members).length })) });
        break;
      }

      // ── UNIRSE A EQUIPO EXISTENTE ─────────────────────────────────────────
      case "join_member": {
        if (game.status !== "waiting") {
          ws.send(JSON.stringify({ type: "error", message: "El juego ya comenzó." })); return;
        }
        const team = Object.values(game.teams).find(
          t => t.name.toLowerCase() === (msg.teamName || "").trim().toLowerCase()
        );
        if (!team) {
          ws.send(JSON.stringify({ type: "error", message: "Equipo no encontrado. Verifica el nombre exacto." })); return;
        }
        const memberName = (msg.memberName || "Miembro").trim().slice(0, 20);
        const memberId = uuidv4();
        team.members[memberId] = { id: memberId, name: memberName, vote: null };
        conns.set(ws, { role: "member", teamId: team.id, memberId });
        ws.send(JSON.stringify({ type: "member_joined", teamId: team.id, teamName: team.name, memberId, memberName }));
        toTeam(team.id, { type: "members_update", members: Object.values(team.members).map(m => m.name) });
        toAll({ type: "teams_update", teams: Object.values(game.teams).map(t => ({ name: t.name, score: t.score, memberCount: Object.keys(t.members).length })) });
        break;
      }

      // ── INICIAR JUEGO ─────────────────────────────────────────────────────
      case "start_game": {
        if (conn?.role !== "host") return;
        if (!Object.keys(game.teams).length) {
          ws.send(JSON.stringify({ type: "error", message: "Necesitas al menos 1 equipo." })); return;
        }
        game.status = "round";
        game.currentRound = 0;
        game.submissions = {};
        game.workingState = {};
        Object.values(game.teams).forEach(t =>
          Object.values(t.members).forEach(m => { m.vote = null; })
        );
        const round = ROUNDS[0];
        game.roundStartTime = Date.now();
        // Inicializar workingState para rondas colaborativas
        if (round.type === "match" || round.type === "strategy") {
          Object.keys(game.teams).forEach(tid => initWorkingState(tid, round));
        }
        toAll({ type: "round_start", index: 0, total: ROUNDS.length, round: sanitize(round) });
        // Enviar snapshot inicial del estado colaborativo a cada equipo
        if (round.type === "match" || round.type === "strategy") {
          Object.keys(game.teams).forEach(tid => {
            toTeam(tid, { type: "collab_update", ...buildCollabSnapshot(tid, round) });
          });
        }
        startRoundTimer(round.timeLimit);
        break;
      }

      // ── SIGUIENTE RONDA ───────────────────────────────────────────────────
      case "next_round": {
        if (conn?.role !== "host") return;
        game.currentRound++;
        if (game.currentRound >= ROUNDS.length) {
          game.status = "finished";
          toAll({ type: "game_over", scoreboard: scoreboard() });
          return;
        }
        game.status = "round";
        game.submissions = {};
        game.workingState = {};
        Object.values(game.teams).forEach(t =>
          Object.values(t.members).forEach(m => { m.vote = null; })
        );
        const round = ROUNDS[game.currentRound];
        game.roundStartTime = Date.now();
        if (round.type === "match" || round.type === "strategy") {
          Object.keys(game.teams).forEach(tid => initWorkingState(tid, round));
        }
        toAll({ type: "round_start", index: game.currentRound, total: ROUNDS.length, round: sanitize(round) });
        if (round.type === "match" || round.type === "strategy") {
          Object.keys(game.teams).forEach(tid => {
            toTeam(tid, { type: "collab_update", ...buildCollabSnapshot(tid, round) });
          });
        }
        startRoundTimer(round.timeLimit);
        break;
      }

      case "reveal_now": {
        if (conn?.role !== "host") return;
        revealRound();
        break;
      }

      case "reset_game": {
        if (conn?.role !== "host") return;
        if (game.roundTimer) clearTimeout(game.roundTimer);
        game = freshState();
        toAll({ type: "game_reset" });
        break;
      }

      // ── RESPUESTA FINAL (mcq, sort) ───────────────────────────────────────
      case "submit_answer": {
        if (!conn?.teamId || game.status !== "round") return;
        if (game.submissions[conn.teamId]) return;
        const round = ROUNDS[game.currentRound];
        // submit_answer solo aplica para mcq y sort
        // match y strategy usan collab_connect / collab_select
        if (round.type === "match" || round.type === "strategy") return;
        const elapsed = (Date.now() - game.roundStartTime) / 1000;
        const earned = computeScore(round, msg.answer, elapsed);
        game.teams[conn.teamId].score += earned;
        game.submissions[conn.teamId] = {
          answer: msg.answer,
          correct: evaluate(round, msg.answer),
          earned,
        };
        toTeam(conn.teamId, {
          type: "answer_received",
          correct: evaluate(round, msg.answer),
          earned,
          score: game.teams[conn.teamId].score,
        });
        toHost({ type: "progress", answered: Object.keys(game.submissions).length, total: Object.keys(game.teams).length });
        if (allSubmitted()) revealRound();
        break;
      }

      // ── VOTO INDIVIDUAL (rondas vote) ─────────────────────────────────────
      case "cast_vote": {
        if (conn?.role !== "member" || game.status !== "round") return;
        const round = ROUNDS[game.currentRound];
        if (round.type !== "vote") return;
        const team = game.teams[conn.teamId];
        if (!team?.members[conn.memberId]) return;
        team.members[conn.memberId].vote = msg.option;
        const members = Object.values(team.members);
        const tally = {};
        members.forEach(m => { if (m.vote !== null) tally[m.vote] = (tally[m.vote] || 0) + 1; });
        toTeam(conn.teamId, {
          type: "vote_update",
          tally,
          voted: members.filter(m => m.vote !== null).length,
          total: members.length,
        });
        const consensus = teamConsensus(conn.teamId);
        if (consensus !== null && !game.submissions[conn.teamId]) {
          const elapsed = (Date.now() - game.roundStartTime) / 1000;
          const isCorrect = evaluate(round, consensus);
          const earned = computeScore(round, consensus, elapsed);
          game.teams[conn.teamId].score += earned;
          game.submissions[conn.teamId] = { answer: consensus, correct: isCorrect, earned };
          toTeam(conn.teamId, {
            type: "answer_received",
            correct: isCorrect, earned,
            score: game.teams[conn.teamId].score,
            consensus: true,
          });
          toHost({ type: "progress", answered: Object.keys(game.submissions).length, total: Object.keys(game.teams).length });
          if (allSubmitted()) revealRound();
        }
        break;
      }

      // ── ACCIÓN COLABORATIVA: CONECTAR PAR (match) ─────────────────────────
      // Un miembro conecta un par izquierda ↔ derecha.
      // El servidor actualiza workingState y hace broadcast al equipo completo.
      // Si todos los pares están conectados → cierra la ronda para ese equipo.
      case "collab_connect": {
        if (conn?.role !== "member" || game.status !== "round") return;
        const round = ROUNDS[game.currentRound];
        if (round.type !== "match") return;
        if (game.submissions[conn.teamId]) return; // ya terminaron

        const { leftIdx, rightIdx } = msg;
        const tid = conn.teamId;
        const ws_state = game.workingState[tid];
        if (!ws_state) return;

        // Verificar que el rightIdx no esté ya usado por otro par
        const rightAlreadyUsed = Object.values(ws_state.connections).includes(rightIdx);
        if (rightAlreadyUsed) {
          ws.send(JSON.stringify({ type: "error", message: "Esa opción ya está conectada por otro par." }));
          return;
        }
        // Si el leftIdx ya tenía una conexión (re-conexión), la actualizamos
        ws_state.connections[String(leftIdx)] = rightIdx;
        ws_state.lockedBy[String(leftIdx)] = game.teams[tid]?.members[conn.memberId]?.name || "?";

        // Broadcast del nuevo estado al equipo completo en tiempo real
        const snapshot = buildCollabSnapshot(tid, round);
        toTeam(tid, { type: "collab_update", ...snapshot });

        // Notificar también al host cuántos pares se han conectado en cada equipo
        toHost({
          type: "collab_progress",
          teamName: game.teams[tid].name,
          done: Object.keys(ws_state.connections).length,
          total: round.pairs.length,
        });

        // ¿Se completaron todos los pares? → cerrar la respuesta del equipo
        if (Object.keys(ws_state.connections).length === round.pairs.length) {
          const elapsed = (Date.now() - game.roundStartTime) / 1000;
          const answer = ws_state.connections;
          const isCorrect = evaluate(round, answer);
          const earned = computeScore(round, answer, elapsed);
          game.teams[tid].score += earned;
          game.submissions[tid] = { answer, correct: isCorrect, earned };
          toTeam(tid, {
            type: "answer_received",
            correct: isCorrect, earned,
            score: game.teams[tid].score,
          });
          toHost({ type: "progress", answered: Object.keys(game.submissions).length, total: Object.keys(game.teams).length });
          if (allSubmitted()) revealRound();
        }
        break;
      }

      // ── ACCIÓN COLABORATIVA: ELEGIR BLOQUE (strategy) ────────────────────
      // Un miembro elige la opción de un bloque de la estrategia.
      // Igual que collab_connect: actualiza workingState y broadcast.
      // Si todos los bloques están elegidos → cierra la respuesta.
      case "collab_select": {
        if (conn?.role !== "member" || game.status !== "round") return;
        const round = ROUNDS[game.currentRound];
        if (round.type !== "strategy") return;
        if (game.submissions[conn.teamId]) return;

        const { blockIdx, optionIdx } = msg;
        const tid = conn.teamId;
        const ws_state = game.workingState[tid];
        if (!ws_state) return;

        ws_state.selections[String(blockIdx)] = optionIdx;
        ws_state.blockOwner[String(blockIdx)] = game.teams[tid]?.members[conn.memberId]?.name || "?";

        const snapshot = buildCollabSnapshot(tid, round);
        toTeam(tid, { type: "collab_update", ...snapshot });

        toHost({
          type: "collab_progress",
          teamName: game.teams[tid].name,
          done: Object.keys(ws_state.selections).length,
          total: round.blocks.length,
        });

        // ¿Se eligieron todos los bloques?
        if (Object.keys(ws_state.selections).length === round.blocks.length) {
          const elapsed = (Date.now() - game.roundStartTime) / 1000;
          // Convertir selections a array para evaluar
          const answer = round.blocks.map((_, i) => ws_state.selections[String(i)] ?? -1);
          const isCorrect = evaluate(round, answer);
          const earned = computeScore(round, answer, elapsed);
          game.teams[tid].score += earned;
          game.submissions[tid] = { answer, correct: isCorrect, earned };
          toTeam(tid, {
            type: "answer_received",
            correct: isCorrect, earned,
            score: game.teams[tid].score,
          });
          toHost({ type: "progress", answered: Object.keys(game.submissions).length, total: Object.keys(game.teams).length });
          if (allSubmitted()) revealRound();
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    const conn = conns.get(ws);
    if (conn?.role === "member" && game.status === "waiting" && conn.teamId) {
      const team = game.teams[conn.teamId];
      if (team) {
        delete team.members[conn.memberId];
        if (!Object.keys(team.members).length) delete game.teams[conn.teamId];
        toAll({ type: "teams_update", teams: Object.values(game.teams).map(t => ({ name: t.name, score: t.score, memberCount: Object.keys(t.members).length })) });
      }
    }
    conns.delete(ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Quiz colaborativo en puerto ${PORT}`));
