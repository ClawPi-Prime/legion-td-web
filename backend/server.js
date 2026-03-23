const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: 5432,
  database: process.env.DB_NAME || 'legion_td',
  user: process.env.DB_USER || 'legion',
  password: process.env.DB_PASSWORD || 'legion_td_dev_password',
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name VARCHAR(64) UNIQUE NOT NULL,
      best_wave INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id),
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      waves_survived INTEGER DEFAULT 0,
      outcome VARCHAR(16)
    );
  `);
  console.log('DB schema ready');
}

// ---- Lobby/game state (in-memory) ----
let currentLobby = null;
let lobbyTimer = null;

// Per-wave vote state: { wave: N, votes: Set<socketId>, buildTimer, buildInterval }
let waveState = null;

function createLobby() {
  return { id: Date.now(), players: [], gameStarted: false };
}

function startWaveCycle(lobbyId, waveNum) {
  if (!currentLobby || currentLobby.id !== lobbyId) return;
  if (waveState && waveState.buildInterval) clearInterval(waveState.buildInterval);
  var remaining = 30;
  waveState = { wave: waveNum, votes: new Set(), buildTimer: remaining, buildInterval: null };
  broadcastWaveState(lobbyId);
  waveState.buildInterval = setInterval(function() {
    if (!currentLobby || currentLobby.id !== lobbyId) { clearInterval(waveState.buildInterval); return; }
    remaining--;
    waveState.buildTimer = remaining;
    broadcastWaveState(lobbyId);
    if (remaining <= 0) {
      clearInterval(waveState.buildInterval);
      fireWave(lobbyId, waveNum);
    }
  }, 1000);
}

function broadcastWaveState(lobbyId) {
  if (!currentLobby || !waveState) return;
  io.to('lobby:' + lobbyId).emit('wave:state', {
    wave: waveState.wave,
    buildTimer: waveState.buildTimer,
    votes: waveState.votes.size,
    needed: currentLobby.players.length,
  });
}

function fireWave(lobbyId, waveNum) {
  if (!currentLobby || currentLobby.id !== lobbyId) return;
  if (waveState && waveState.buildInterval) clearInterval(waveState.buildInterval);
  io.to('lobby:' + lobbyId).emit('wave:go', { wave: waveNum });
}

function broadcastLobby() {
  if (!currentLobby) return;
  io.to('lobby:' + currentLobby.id).emit('lobby:update', {
    id: currentLobby.id,
    players: currentLobby.players.map(function(p) { return { name: p.name, ready: p.ready, race: p.race || 'human' }; }),
    gameStarted: currentLobby.gameStarted,
    countdown: currentLobby.countdown || 60,
  });
}

function startGame(lobbyId) {
  if (!currentLobby || currentLobby.id !== lobbyId) return;
  if (currentLobby.gameStarted) return;
  clearTimeout(lobbyTimer);
  currentLobby.gameStarted = true;
  currentLobby.countdown = 0;
  currentLobby._waveCompleted = 0;
  console.log('Game starting for lobby', lobbyId, 'players:', currentLobby.players.map(p=>p.name));
  io.to('lobby:' + lobbyId).emit('game:start', {
    players: currentLobby.players.map(function(p) { return { name: p.name, index: p.index, race: p.race || 'human' }; })
  });
  // Start wave cycle from wave 1
  startWaveCycle(lobbyId, 1);
}

// ---- Socket.io ----
io.on('connection', function(socket) {
  console.log('connect', socket.id);

  socket.on('lobby:join', function(data) {
    var name = (data && data.name) ? data.name.trim().slice(0, 32) : 'Anon';

    // Create lobby if needed
    if (!currentLobby) currentLobby = createLobby();
    // Don't let more than 2 join (start new lobby when current is full)
    if (currentLobby.gameStarted || currentLobby.players.length >= 2) {
      currentLobby = createLobby();
      clearTimeout(lobbyTimer);
    }

    var playerIndex = currentLobby.players.length;
    var player = { socketId: socket.id, name: name, index: playerIndex, ready: true, race: 'human' };
    currentLobby.players.push(player);
    socket.join('lobby:' + currentLobby.id);
    socket.lobbyId = currentLobby.id;
    socket.playerIndex = playerIndex;
    socket.playerName = name;

    console.log('lobby:join', name, 'lobby', currentLobby.id, 'players:', currentLobby.players.length);
    broadcastLobby();

    if (currentLobby.players.length === 2) {
      var lid = currentLobby.id;
      setTimeout(function() { startGame(lid); }, 500);
    } else {
      // One player — start 60s countdown
      var lid = currentLobby.id;
      var remaining = 60;
      currentLobby.countdown = remaining;
      broadcastLobby();
      var tick = setInterval(function() {
        if (!currentLobby || currentLobby.id !== lid || currentLobby.gameStarted) {
          clearInterval(tick);
          return;
        }
        remaining--;
        currentLobby.countdown = remaining;
        broadcastLobby();
        if (remaining <= 0) {
          clearInterval(tick);
          startGame(lid);
        }
      }, 1000);
      lobbyTimer = tick;
    }
  });

  // Race selection
  socket.on('lobby:race', function(data) {
    if (!socket.lobbyId || !currentLobby) return;
    var player = currentLobby.players.find(function(p) { return p.socketId === socket.id; });
    if (!player) return;
    var race = (data && data.race) ? data.race : 'human';
    player.race = race;
    broadcastLobby();
  });

  // Wave vote
  socket.on('wave:vote', function(data) {
    if (!socket.lobbyId || !currentLobby || !waveState) return;
    if (!currentLobby.gameStarted) return;
    waveState.votes.add(socket.id);
    broadcastWaveState(socket.lobbyId);
    // If all players voted, start early
    if (waveState.votes.size >= currentLobby.players.length) {
      var lid = socket.lobbyId, wn = waveState.wave;
      if (waveState.buildInterval) clearInterval(waveState.buildInterval);
      fireWave(lid, wn);
    }
  });

  // Wave complete — client signals wave is done, server starts next build phase
  socket.on('wave:complete', function(data) {
    if (!socket.lobbyId || !currentLobby) return;
    // Only need one player to report completion (they're synced)
    // Use a simple flag to avoid double-fire
    if (currentLobby._waveCompleted === data.wave) return;
    currentLobby._waveCompleted = data.wave;
    var nextWave = (data.wave || 1) + 1;
    var lid = socket.lobbyId;
    setTimeout(function() { startWaveCycle(lid, nextWave); }, 1800);
  });

  // Game state broadcast: each player sends their full game state every ~150ms
  socket.on('game:state', function(data) {
    if (!socket.lobbyId) return;
    // Relay to all OTHER players in same lobby
    socket.to('lobby:' + socket.lobbyId).emit('opponent:state', {
      playerIndex: socket.playerIndex,
      name: socket.playerName,
      state: data,
    });
  });

  // Game over: one player's king died
  socket.on('game:over', function(data) {
    if (!socket.lobbyId) return;
    io.to('lobby:' + socket.lobbyId).emit('game:ended', {
      loser: socket.playerName,
      loserIndex: socket.playerIndex,
      wave: data && data.wave,
    });
    savePlayerScore(socket.playerName, data && data.wave);
    if (waveState && waveState.buildInterval) clearInterval(waveState.buildInterval);
    waveState = null;
    currentLobby = null;
  });

  socket.on('disconnect', function() {
    console.log('disconnect', socket.id, socket.playerName);
    if (socket.lobbyId && currentLobby && currentLobby.id === socket.lobbyId && currentLobby.gameStarted) {
      io.to('lobby:' + socket.lobbyId).emit('game:ended', {
        loser: socket.playerName, loserIndex: socket.playerIndex, reason: 'disconnect'
      });
      if (waveState && waveState.buildInterval) clearInterval(waveState.buildInterval);
      waveState = null;
      currentLobby = null;
    } else if (socket.lobbyId && currentLobby && currentLobby.id === socket.lobbyId && !currentLobby.gameStarted) {
      // Remove from lobby
      currentLobby.players = currentLobby.players.filter(function(p) { return p.socketId !== socket.id; });
      if (currentLobby.players.length === 0) {
        clearTimeout(lobbyTimer);
        currentLobby = null;
      } else {
        broadcastLobby();
      }
    }
  });
});

async function savePlayerScore(name, wave) {
  if (!name || !wave) return;
  try {
    await pool.query(
      `INSERT INTO players (name, best_wave, games_played)
       VALUES ($1, $2, 1)
       ON CONFLICT (name) DO UPDATE SET
         best_wave = GREATEST(players.best_wave, $2),
         games_played = players.games_played + 1,
         updated_at = NOW()`,
      [name, wave]
    );
  } catch(e) { console.error('saveScore error', e.message); }
}

// ---- REST API ----
app.get('/health', function(req, res) { res.json({ status: 'ok', ts: new Date() }); });

app.post('/players', async function(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      `INSERT INTO players (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [name]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/players', async function(req, res) {
  try {
    const result = await pool.query(
      'SELECT name, best_wave, games_played FROM players ORDER BY best_wave DESC, games_played DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
initDb().then(function() {
  httpServer.listen(PORT, function() { console.log('Backend listening on :' + PORT); });
}).catch(function(err) {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
