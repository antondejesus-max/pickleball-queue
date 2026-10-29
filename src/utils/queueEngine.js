/**
 * Pickleball Queue Rotation Engine with Firebase Firestore Integration
 * 
 * Features:
 * - Dual player entry: Reclub JSON import & Manual walk-in players.
 * - Player status tracking: 'active', 'resting', 'left'.
 * - Open Play Match rules:
 *   - First game: pairs balanced by rating or random.
 *   - Winning team: splits partners for the next game.
 *   - Consecutive game cap: players hitting 2 consecutive games rotate to the back of the queue.
 *   - Losing team: rotates to the back of the queue.
 * - DUPR Export: Download finished matches as an official DUPR-compatible CSV file.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase.js';

export const PLAYER_STATUS = {
  ACTIVE: 'active',
  RESTING: 'resting',
  LEFT: 'left'
};

export const ENTRY_TYPE = {
  RECLUB: 'reclub',
  WALK_IN: 'walk-in'
};

export const MATCH_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
};

const PLAYERS_COLLECTION = 'players';
const MATCHES_COLLECTION = 'matches';

// ==========================================
// 1. HELPER & PURE ROTATION FUNCTIONS
// ==========================================

/**
 * Splits a full name into firstName and lastName
 */
export function splitPlayerName(fullName = '') {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: 'Player', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * Shuffles an array randomly using Fisher-Yates
 */
export function shuffleArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Pairs 4 players for their first game.
 * - If mode is 'balanced', sorts players by rating and pairs (1st + 4th) vs (2nd + 3rd)
 * - If mode is 'random', randomly shuffles and splits into two teams of 2
 * 
 * @param {Array} fourPlayers Array of 4 player objects
 * @param {Object} options { mode: 'balanced' | 'random' }
 * @returns {{ team1: Array, team2: Array }}
 */
export function pairFirstGame(fourPlayers, { mode = 'balanced' } = {}) {
  if (!fourPlayers || fourPlayers.length < 4) {
    throw new Error('pairFirstGame requires exactly 4 players.');
  }

  const pool = fourPlayers.slice(0, 4);

  if (mode === 'balanced') {
    // Sort descending by rating (default rating 3.5 if missing)
    const sorted = [...pool].sort((a, b) => {
      const ratingA = Number(a.rating ?? a.duprRating ?? 3.5);
      const ratingB = Number(b.rating ?? b.duprRating ?? 3.5);
      return ratingB - ratingA;
    });

    // Classic balance: highest + lowest vs middle two
    return {
      team1: [sorted[0], sorted[3]],
      team2: [sorted[1], sorted[2]]
    };
  }

  // Random pairing
  const shuffled = shuffleArray(pool);
  return {
    team1: [shuffled[0], shuffled[1]],
    team2: [shuffled[2], shuffled[3]]
  };
}

/**
 * Calculates the next match rotation and player updates after a match finishes.
 * 
 * Match Rules:
 * 1. Losers go to the back of the queue (consecutiveGames reset to 0).
 * 2. Winners increment consecutiveGames.
 * 3. Players hitting 2 consecutive games go to the back of the queue (consecutiveGames reset to 0).
 * 4. Remaining winners stay on court:
 *    - If 2 winners stay: winning team SPLITS for the next game (Winner A on Team 1, Winner B on Team 2).
 *      2 incoming players from queue are paired with them (balanced by rating or random).
 *    - If 1 winner stays: Winner stays on Team 1. 3 incoming players from queue enter court.
 *    - If 0 winners stay: 4 new players taken from queue, paired via pairFirstGame.
 * 
 * @param {Object} params
 * @param {Object} params.match The completed match object { team1, team2 }
 * @param {number} params.winningTeamIndex 1 for team1, 2 for team2
 * @param {Array} params.queuePlayers Array of currently waiting active players (ordered by queuePosition/joinedAt)
 * @param {string} params.balanceMode 'balanced' | 'random'
 * @returns {Object} { nextMatch, updatedCourtPlayers, updatedQueuePlayers, remainingQueue }
 */
export function calculateNextMatchRotation({
  match,
  winningTeamIndex,
  queuePlayers = [],
  balanceMode = 'balanced'
}) {
  const team1 = match.team1 || [];
  const team2 = match.team2 || [];

  const winningTeam = winningTeamIndex === 1 ? team1 : team2;
  const losingTeam = winningTeamIndex === 1 ? team2 : team1;

  const now = Date.now();
  const losersToQueue = [];
  const winnersToQueue = [];
  const winnersStayingOnCourt = [];

  // 1. Process Losers: all go to back of the queue
  losingTeam.forEach((p, idx) => {
    losersToQueue.push({
      ...p,
      gamesPlayed: (p.gamesPlayed || 0) + 1,
      consecutiveGames: 0,
      currentCourtId: null,
      queuePosition: now + idx * 10 // small offset to preserve finish order
    });
  });

  // 2. Process Winners
  winningTeam.forEach((p, idx) => {
    const consecutive = (p.consecutiveGames || 0) + 1;
    const gamesPlayed = (p.gamesPlayed || 0) + 1;

    if (consecutive >= 2) {
      // Hit 2 consecutive games -> goes to back of queue!
      winnersToQueue.push({
        ...p,
        gamesPlayed,
        consecutiveGames: 0,
        currentCourtId: null,
        queuePosition: now + (losingTeam.length + idx) * 10
      });
    } else {
      // Can stay on court for their 2nd consecutive game
      winnersStayingOnCourt.push({
        ...p,
        gamesPlayed,
        consecutiveGames: consecutive
      });
    }
  });

  // Combine players moving to the back of the queue
  const playersRotatingToBack = [...losersToQueue, ...winnersToQueue];

  // 3. Form the next match on this court
  // queuePlayers contains waiting players in arrival order
  const spotsNeeded = 4 - winnersStayingOnCourt.length;

  let nextMatch = null;
  let remainingQueue = [...queuePlayers];
  let incomingPlayers = [];

  // Filter only eligible (active) candidates, skipping resting players
  const eligibleActivePlayers = queuePlayers.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === undefined
  );

  if (eligibleActivePlayers.length >= spotsNeeded) {
    // Pick the first spotsNeeded active players from queuePlayers (skipping resting players!)
    for (const p of queuePlayers) {
      if (incomingPlayers.length === spotsNeeded) break;
      if (p.status === PLAYER_STATUS.ACTIVE || p.status === undefined) {
        incomingPlayers.push(p);
      }
      // If p.status === 'resting', it is skipped and remains in the queue!
    }

    const selectedIds = new Set(incomingPlayers.map((p) => p.id));
    remainingQueue = queuePlayers.filter((p) => !selectedIds.has(p.id));

    if (winnersStayingOnCourt.length === 2) {
      // Winning team SPLITS!
      const [winnerA, winnerB] = winnersStayingOnCourt;
      const [incomingA, incomingB] = incomingPlayers;

      if (balanceMode === 'balanced') {
        const ratingWA = Number(winnerA.rating ?? winnerA.duprRating ?? 3.5);
        const ratingWB = Number(winnerB.rating ?? winnerB.duprRating ?? 3.5);
        const ratingIA = Number(incomingA.rating ?? incomingA.duprRating ?? 3.5);
        const ratingIB = Number(incomingB.rating ?? incomingB.duprRating ?? 3.5);

        // Pair higher winner with lower incoming, lower winner with higher incoming
        const higherWinner = ratingWA >= ratingWB ? winnerA : winnerB;
        const lowerWinner = ratingWA >= ratingWB ? winnerB : winnerA;
        const higherIncoming = ratingIA >= ratingIB ? incomingA : incomingB;
        const lowerIncoming = ratingIA >= ratingIB ? incomingB : incomingA;

        nextMatch = {
          team1: [higherWinner, lowerIncoming],
          team2: [lowerWinner, higherIncoming]
        };
      } else {
        // Random split
        const [randIn1, randIn2] = shuffleArray([incomingA, incomingB]);
        nextMatch = {
          team1: [winnerA, randIn1],
          team2: [winnerB, randIn2]
        };
      }
    } else if (winnersStayingOnCourt.length === 1) {
      // 1 winner stays, 3 incoming players join
      const soleWinner = winnersStayingOnCourt[0];

      if (balanceMode === 'balanced') {
        // Sort the 3 incoming players by rating
        const sortedIn = [...incomingPlayers].sort((a, b) => {
          const rA = Number(a.rating ?? a.duprRating ?? 3.5);
          const rB = Number(b.rating ?? b.duprRating ?? 3.5);
          return rB - rA;
        });
        // Pair sole winner with middle incoming, team 2 gets highest + lowest
        nextMatch = {
          team1: [soleWinner, sortedIn[1]],
          team2: [sortedIn[0], sortedIn[2]]
        };
      } else {
        const shuffled = shuffleArray(incomingPlayers);
        nextMatch = {
          team1: [soleWinner, shuffled[0]],
          team2: [shuffled[1], shuffled[2]]
        };
      }
    } else {
      // 0 winners stay (both hit 2 games cap) -> 4 new players
      nextMatch = pairFirstGame(incomingPlayers, { mode: balanceMode });
    }
  }

  return {
    nextMatch,
    winnersStayingOnCourt,
    playersRotatingToBack,
    incomingPlayers,
    remainingQueue
  };
}

// ==========================================
// 2. RECLUB IMPORT & WALKIN PARSING
// ==========================================

/**
 * Parses and sanitizes a Reclub JSON export or attendee list.
 * Supports various formats: direct array, { attendees: [...] }, { members: [...] }, { data: [...] }
 * 
 * @param {string|Object|Array} input JSON string or parsed object
 * @returns {Array} Array of sanitized player objects
 */
export function parseReclubJson(input) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (e) {
      throw new Error(`Invalid JSON format: ${e.message}`);
    }
  }

  let rawList = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.attendees)) rawList = data.attendees;
    else if (Array.isArray(data.participants)) rawList = data.participants;
    else if (Array.isArray(data.members)) rawList = data.members;
    else if (Array.isArray(data.players)) rawList = data.players;
    else if (Array.isArray(data.data)) rawList = data.data;
    else if (Array.isArray(data.users)) rawList = data.users;
    else {
      // Look for any array property
      const firstArray = Object.values(data).find(v => Array.isArray(v));
      if (firstArray) rawList = firstArray;
    }
  }

  if (!rawList || rawList.length === 0) {
    throw new Error('No player records found in the provided Reclub data.');
  }

  const now = Date.now();

  return rawList.map((item, index) => {
    let rawName = '';
    let rating = 3.5;
    let duprId = '';
    let email = '';

    if (typeof item === 'string') {
      rawName = item;
    } else if (item && typeof item === 'object') {
      const userObj = item.user || item.player || item.member || item;

      rawName =
        userObj.name ||
        userObj.displayName ||
        userObj.fullName ||
        (userObj.firstName ? `${userObj.firstName} ${userObj.lastName || ''}`.trim() : '') ||
        userObj.username ||
        `Player ${index + 1}`;

      rating =
        Number(userObj.rating ?? userObj.duprRating ?? userObj.dupr ?? userObj.skillLevel ?? 3.5) || 3.5;
      duprId = String(userObj.duprId || userObj.dupr_id || userObj.duprIdNumber || '').trim();
      email = String(userObj.email || userObj.userEmail || '').trim();
    }

    const { firstName, lastName } = splitPlayerName(rawName);

    return {
      name: rawName.trim(),
      firstName,
      lastName,
      rating: Number(rating.toFixed(2)),
      duprId,
      email,
      status: PLAYER_STATUS.ACTIVE,
      entryType: ENTRY_TYPE.RECLUB,
      gamesPlayed: 0,
      consecutiveGames: 0,
      queuePosition: now + index * 10,
      currentCourtId: null
    };
  });
}

// ==========================================
// 3. DUPR-COMPATIBLE CSV EXPORT
// ==========================================

/**
 * Escapes a string value for safe CSV output
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats a date value to YYYY-MM-DD
 */
function formatDate(dateValue) {
  if (!dateValue) return new Date().toISOString().split('T')[0];
  if (typeof dateValue.toDate === 'function') {
    return dateValue.toDate().toISOString().split('T')[0];
  }
  const d = new Date(dateValue);
  return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
}

/**
 * Generates a standard DUPR-compatible CSV string from finished matches.
 * 
 * Standard DUPR Bulk Match Upload columns:
 * - Match Date (YYYY-MM-DD)
 * - Match Type (Doubles / Singles)
 * - Scoring Type (Sideout / Standard)
 * - Event Name
 * - Player 1 First Name, Player 1 Last Name, Player 1 DUPR ID, Player 1 Email
 * - Player 2 First Name, Player 2 Last Name, Player 2 DUPR ID, Player 2 Email
 * - Player 3 First Name, Player 3 Last Name, Player 3 DUPR ID, Player 3 Email
 * - Player 4 First Name, Player 4 Last Name, Player 4 DUPR ID, Player 4 Email
 * - Game 1 Team 1 Score, Game 1 Team 2 Score
 * 
 * @param {Array} finishedMatches Array of match objects
 * @param {Object} options Optional configurations (eventName, scoringType, matchType)
 * @returns {string} CSV formatted string
 */
export function generateDuprCsv(finishedMatches = [], options = {}) {
  const headers = [
    'Match Date',
    'Match Type',
    'Scoring Type',
    'Event Name',
    'Player 1 First Name',
    'Player 1 Last Name',
    'Player 1 DUPR ID',
    'Player 1 Email',
    'Player 2 First Name',
    'Player 2 Last Name',
    'Player 2 DUPR ID',
    'Player 2 Email',
    'Player 3 First Name',
    'Player 3 Last Name',
    'Player 3 DUPR ID',
    'Player 3 Email',
    'Player 4 First Name',
    'Player 4 Last Name',
    'Player 4 DUPR ID',
    'Player 4 Email',
    'Game 1 Team 1 Score',
    'Game 1 Team 2 Score'
  ];

  const rows = [headers.join(',')];

  finishedMatches.forEach((m) => {
    const matchDate = formatDate(m.completedAt || m.startedAt || m.date);
    const matchType = m.matchType || options.matchType || 'Doubles';
    const scoringType = m.scoringType || options.scoringType || 'Sideout';
    const eventName = m.eventName || options.eventName || 'Pickleball Open Play';

    // Team 1 (Player 1, Player 2)
    const t1p1 = (m.team1 && m.team1[0]) || {};
    const t1p2 = (m.team1 && m.team1[1]) || {};
    // Team 2 (Player 3, Player 4)
    const t2p1 = (m.team2 && m.team2[0]) || {};
    const t2p2 = (m.team2 && m.team2[1]) || {};

    const name1 = splitPlayerName(t1p1.name || `${t1p1.firstName || ''} ${t1p1.lastName || ''}`);
    const name2 = splitPlayerName(t1p2.name || `${t1p2.firstName || ''} ${t1p2.lastName || ''}`);
    const name3 = splitPlayerName(t2p1.name || `${t2p1.firstName || ''} ${t2p1.lastName || ''}`);
    const name4 = splitPlayerName(t2p2.name || `${t2p2.firstName || ''} ${t2p2.lastName || ''}`);

    const team1Score = m.score?.team1 ?? m.team1Score ?? '';
    const team2Score = m.score?.team2 ?? m.team2Score ?? '';

    const rowValues = [
      matchDate,
      matchType,
      scoringType,
      eventName,
      t1p1.firstName || name1.firstName,
      t1p1.lastName || name1.lastName,
      t1p1.duprId || '',
      t1p1.email || '',
      t1p2.firstName || name2.firstName,
      t1p2.lastName || name2.lastName,
      t1p2.duprId || '',
      t1p2.email || '',
      t2p1.firstName || name3.firstName,
      t2p1.lastName || name3.lastName,
      t2p1.duprId || '',
      t2p1.email || '',
      t2p2.firstName || name4.firstName,
      t2p2.lastName || name4.lastName,
      t2p2.duprId || '',
      t2p2.email || '',
      team1Score,
      team2Score
    ];

    rows.push(rowValues.map(escapeCsvValue).join(','));
  });

  return rows.join('\r\n');
}

/**
 * Triggers a browser download of the finished matches as a DUPR-compatible CSV file.
 * 
 * @param {Array} finishedMatches
 * @param {string} filename Optional custom filename
 * @param {Object} options
 */
export function downloadDuprCsv(finishedMatches = [], filename = null, options = {}) {
  const csvContent = generateDuprCsv(finishedMatches, options);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const defaultFilename = `dupr_matches_${new Date().toISOString().split('T')[0]}.csv`;
  const exportFilename = filename || defaultFilename;

  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return csvContent;
}

// ==========================================
// 4. FIREBASE FIRESTORE INTEGRATION
// ==========================================

/**
 * Adds a manual walk-in player to Firestore
 */
export async function addWalkInPlayer({
  name,
  rating = 3.5,
  duprId = '',
  email = '',
  status = PLAYER_STATUS.ACTIVE
}) {
  if (!name || !name.trim()) {
    throw new Error('Player name is required.');
  }

  const { firstName, lastName } = splitPlayerName(name);
  const now = Date.now();

  const playerData = {
    name: name.trim(),
    firstName,
    lastName,
    rating: Number(Number(rating || 3.5).toFixed(2)),
    duprId: String(duprId || '').trim(),
    email: String(email || '').trim(),
    status,
    entryType: ENTRY_TYPE.WALK_IN,
    gamesPlayed: 0,
    consecutiveGames: 0,
    queuePosition: now,
    currentCourtId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, PLAYERS_COLLECTION), playerData);
  return { id: docRef.id, ...playerData };
}

/**
 * Imports Reclub JSON and batch writes players to Firestore
 */
export async function importReclubPlayers(jsonData) {
  const parsedPlayers = parseReclubJson(jsonData);
  const batch = writeBatch(db);
  const createdPlayers = [];

  for (const player of parsedPlayers) {
    const docRef = doc(collection(db, PLAYERS_COLLECTION));
    const fullRecord = {
      ...player,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    batch.set(docRef, fullRecord);
    createdPlayers.push({ id: docRef.id, ...fullRecord });
  }

  await batch.commit();
  return createdPlayers;
}

/**
 * Updates a player's status: 'active', 'resting', or 'left'.
 * Note: Resting players retain their current queue position.
 */
export async function updatePlayerStatus(playerId, newStatus) {
  if (!Object.values(PLAYER_STATUS).includes(newStatus)) {
    throw new Error(`Invalid status: "${newStatus}". Must be one of: active, resting, left.`);
  }

  const playerRef = doc(db, PLAYERS_COLLECTION, playerId);
  const updates = {
    status: newStatus,
    updatedAt: serverTimestamp()
  };

  // Note: queuePosition is preserved so the player retains their spot in line when toggling between active and resting.
  await updateDoc(playerRef, updates);
  return { id: playerId, ...updates };
}

/**
 * Subscribes to real-time updates for all players
 */
export function subscribePlayers(callback, onError) {
  const q = query(collection(db, PLAYERS_COLLECTION), orderBy('queuePosition', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const players = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(players);
    },
    onError
  );
}

/**
 * Returns a Set of player IDs currently on any active court
 */
export function getPlayingPlayerIds(activeMatches = []) {
  const playingIds = new Set();
  (activeMatches || []).forEach((m) => {
    if (m.status === MATCH_STATUS.IN_PROGRESS) {
      (m.team1 || []).forEach((p) => {
        if (p && p.id) playingIds.add(p.id);
      });
      (m.team2 || []).forEach((p) => {
        if (p && p.id) playingIds.add(p.id);
      });
    }
  });
  return playingIds;
}

/**
 * Returns all players currently waiting in the queue (not currently playing on any active court).
 * Includes BOTH active and resting players, ordered by queuePosition.
 * This determines each player's persistent queue number (#1, #2, #3, ...).
 */
export function getWaitingQueue(players = [], activeMatches = []) {
  const playingIds = getPlayingPlayerIds(activeMatches);

  return (players || [])
    .filter((p) => {
      if (p.status === PLAYER_STATUS.LEFT) return false;
      // If player is currently in an active match, they are on court (not waiting in queue)
      if (playingIds.has(p.id)) return false;
      return true;
    })
    .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
}

/**
 * Filters and returns active, eligible waiting queue players (status == 'active').
 * Resting players are skipped for selection, but remain in getWaitingQueue.
 */
export function getEligibleQueue(players = [], activeMatches = []) {
  return getWaitingQueue(players, activeMatches).filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === undefined
  );
}

/**
 * Backward-compatible alias
 */
export const getActiveQueue = getEligibleQueue;

/**
 * Starts a new match in Firestore and assigns court ID to participating players
 */
export async function startMatch({
  courtId = 'court-1',
  courtName = 'Court 1',
  team1 = [],
  team2 = [],
  eventName = 'Pickleball Open Play',
  scoringType = 'Sideout',
  matchType = 'Doubles',
  startedAt = null
}) {
  if (team1.length !== 2 || team2.length !== 2) {
    throw new Error('A doubles match requires 2 players on Team 1 and 2 players on Team 2.');
  }

  const batch = writeBatch(db);

  // 1. Close any older in-progress matches on this court to prevent orphaned matches
  const existingMatchesQuery = query(
    collection(db, MATCHES_COLLECTION),
    where('courtId', '==', courtId),
    where('status', '==', MATCH_STATUS.IN_PROGRESS)
  );
  const existingSnap = await getDocs(existingMatchesQuery);
  for (const d of existingSnap.docs) {
    batch.update(d.ref, {
      status: MATCH_STATUS.COMPLETED,
      completedAt: serverTimestamp()
    });
    // Ensure all players from this replaced match have their currentCourtId cleared
    const oldMatch = d.data();
    const oldPlayers = [...(oldMatch.team1 || []), ...(oldMatch.team2 || [])];
    for (const oldP of oldPlayers) {
      if (oldP && oldP.id) {
        batch.update(doc(db, PLAYERS_COLLECTION, oldP.id), {
          currentCourtId: null,
          updatedAt: serverTimestamp()
        });
      }
    }
  }

  // 2. Create the new match record
  const matchData = {
    courtId,
    courtName,
    team1,
    team2,
    eventName,
    scoringType,
    matchType,
    status: MATCH_STATUS.IN_PROGRESS,
    startedAt: startedAt || serverTimestamp(),
    completedAt: null,
    score: null,
    winningTeam: null
  };

  const matchRef = doc(collection(db, MATCHES_COLLECTION));
  batch.set(matchRef, matchData);

  // 3. Update players' currentCourtId
  const matchPlayers = [...team1, ...team2];
  for (const player of matchPlayers) {
    if (player.id) {
      const playerRef = doc(db, PLAYERS_COLLECTION, player.id);
      batch.update(playerRef, {
        currentCourtId: courtId,
        updatedAt: serverTimestamp()
      });
    }
  }

  await batch.commit();

  return { id: matchRef.id, ...matchData };
}

/**
 * Completes a match, updates scores & winners, rotates players according to open play rules,
 * and updates Firestore.
 * 
 * @param {Object} params
 * @param {string} params.matchId
 * @param {number} params.winningTeamIndex 1 or 2
 * @param {Object} params.score { team1: number, team2: number }
 * @param {Array} params.currentPlayersList Latest snapshot of all players
 * @param {string} params.balanceMode 'balanced' | 'random'
 * @param {boolean} params.rotateNext If false, ends the game and vacates court without pulling from queue
 */
export async function completeMatch({
  matchId,
  winningTeamIndex,
  score = { team1: 11, team2: 9 },
  currentPlayersList = [],
  balanceMode = 'balanced',
  rotateNext = true
}) {
  const matchRef = doc(db, MATCHES_COLLECTION, matchId);
  const matchSnap = await getDoc(matchRef);

  if (!matchSnap.exists()) {
    throw new Error(`Match with ID "${matchId}" not found.`);
  }

  const matchData = matchSnap.data();
  const batch = writeBatch(db);

  // 1. Update Match record
  batch.update(matchRef, {
    status: MATCH_STATUS.COMPLETED,
    score,
    winningTeam: winningTeamIndex,
    completedAt: serverTimestamp()
  });

  // If rotateNext is FALSE: End game, submit final score, and do NOT pull from queue!
  if (!rotateNext) {
    const allCourtPlayers = [...(matchData.team1 || []), ...(matchData.team2 || [])];
    const now = Date.now();

    allCourtPlayers.forEach((p, idx) => {
      if (p.id) {
        const pRef = doc(db, PLAYERS_COLLECTION, p.id);
        batch.update(pRef, {
          gamesPlayed: (p.gamesPlayed || 0) + 1,
          consecutiveGames: 0,
          currentCourtId: null,
          queuePosition: now + idx * 10,
          updatedAt: serverTimestamp()
        });
      }
    });

    await batch.commit();

    return {
      completedMatchId: matchId,
      rotation: {
        nextMatch: null,
        incomingPlayers: [],
        winnersStayingOnCourt: [],
        playersRotatingToBack: allCourtPlayers
      }
    };
  }

  // Find players currently on OTHER active courts
  const otherActiveMatchesQuery = query(
    collection(db, MATCHES_COLLECTION),
    where('status', '==', MATCH_STATUS.IN_PROGRESS)
  );
  const otherMatchesSnap = await getDocs(otherActiveMatchesQuery);
  const otherPlayingIds = new Set();
  otherMatchesSnap.docs.forEach((d) => {
    if (d.id !== matchId) {
      const m = d.data();
      (m.team1 || []).forEach((p) => p && p.id && otherPlayingIds.add(p.id));
      (m.team2 || []).forEach((p) => p && p.id && otherPlayingIds.add(p.id));
    }
  });

  // Determine current waiting queue (excluding players in this match or playing on other courts)
  const thisMatchPlayerIds = new Set(
    [...(matchData.team1 || []), ...(matchData.team2 || [])].map((p) => p.id)
  );

  const waitingQueue = (currentPlayersList || [])
    .filter((p) => p.status !== PLAYER_STATUS.LEFT && !thisMatchPlayerIds.has(p.id) && !otherPlayingIds.has(p.id))
    .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

  // Calculate rotation (skips resting players, keeping them in line!)
  const rotation = calculateNextMatchRotation({
    match: matchData,
    winningTeamIndex,
    queuePlayers: waitingQueue,
    balanceMode
  });

  // 2. Update players rotating to the back of the queue (losers + winners who hit 2 games cap)
  for (const p of rotation.playersRotatingToBack) {
    if (p.id) {
      const pRef = doc(db, PLAYERS_COLLECTION, p.id);
      batch.update(pRef, {
        gamesPlayed: p.gamesPlayed,
        consecutiveGames: 0,
        currentCourtId: null,
        queuePosition: p.queuePosition,
        updatedAt: serverTimestamp()
      });
    }
  }

  // 3. Update winners staying on court
  for (const p of rotation.winnersStayingOnCourt) {
    if (p.id) {
      const pRef = doc(db, PLAYERS_COLLECTION, p.id);
      batch.update(pRef, {
        gamesPlayed: p.gamesPlayed,
        consecutiveGames: p.consecutiveGames,
        // If next match is starting, keep courtId; if no match forms, reset courtId so they don't get stuck
        currentCourtId: rotation.nextMatch ? matchData.courtId : null,
        updatedAt: serverTimestamp()
      });
    }
  }

  // 4. If next match was formed, update the incoming players' currentCourtId as well
  if (rotation.nextMatch) {
    for (const p of (rotation.incomingPlayers || [])) {
      if (p.id) {
        const pRef = doc(db, PLAYERS_COLLECTION, p.id);
        batch.update(pRef, {
          currentCourtId: matchData.courtId,
          updatedAt: serverTimestamp()
        });
      }
    }
  }

  await batch.commit();

  return {
    completedMatchId: matchId,
    rotation
  };
}

/**
 * Ends a match with final scores submitted, vacates the court, and rotates all 4 players
 * to the back of the queue without pulling any new players from the queue.
 */
export async function endMatchWithoutRotation({
  matchId,
  winningTeamIndex,
  score = { team1: 11, team2: 9 },
  currentPlayersList = []
}) {
  return completeMatch({
    matchId,
    winningTeamIndex,
    score,
    currentPlayersList,
    rotateNext: false
  });
}

/**
 * Subscribes to real-time matches
 */
export function subscribeMatches(callback, onError) {
  const q = query(collection(db, MATCHES_COLLECTION), orderBy('startedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const matches = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(matches);
    },
    onError
  );
}

/**
 * Computes session standings / leaderboard for players from completed matches
 */
export function computeStandings(players = [], completedMatches = []) {
  const statsMap = new Map();

  players.forEach((p) => {
    statsMap.set(p.id, {
      id: p.id,
      name: p.name,
      rating: p.rating ?? 3.5,
      status: p.status,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDifferential: 0,
      winRate: 0
    });
  });

  completedMatches.forEach((m) => {
    if (m.status !== MATCH_STATUS.COMPLETED || !m.score) return;

    const t1Score = Number(m.score.team1 || 0);
    const t2Score = Number(m.score.team2 || 0);
    const t1Won = m.winningTeam === 1 || t1Score > t2Score;

    // Team 1 players
    (m.team1 || []).forEach((p) => {
      const stat = statsMap.get(p.id) || {
        id: p.id,
        name: p.name,
        rating: p.rating ?? 3.5,
        status: p.status || 'active',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifferential: 0,
        winRate: 0
      };
      stat.gamesPlayed += 1;
      if (t1Won) stat.wins += 1;
      else stat.losses += 1;
      stat.pointsFor += t1Score;
      stat.pointsAgainst += t2Score;
      stat.pointDifferential = stat.pointsFor - stat.pointsAgainst;
      statsMap.set(p.id, stat);
    });

    // Team 2 players
    (m.team2 || []).forEach((p) => {
      const stat = statsMap.get(p.id) || {
        id: p.id,
        name: p.name,
        rating: p.rating ?? 3.5,
        status: p.status || 'active',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifferential: 0,
        winRate: 0
      };
      stat.gamesPlayed += 1;
      if (!t1Won) stat.wins += 1;
      else stat.losses += 1;
      stat.pointsFor += t2Score;
      stat.pointsAgainst += t1Score;
      stat.pointDifferential = stat.pointsFor - stat.pointsAgainst;
      statsMap.set(p.id, stat);
    });
  });

  const list = Array.from(statsMap.values()).map((s) => ({
    ...s,
    winRate: s.gamesPlayed > 0 ? Math.round((s.wins / s.gamesPlayed) * 100) : 0
  }));

  // Sort by wins (desc), then point diff (desc), then rating (desc)
  return list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointDifferential !== a.pointDifferential) return b.pointDifferential - a.pointDifferential;
    return (b.rating || 0) - (a.rating || 0);
  });
}

/**
 * Fetches all completed matches and triggers a DUPR CSV download
 */
export async function downloadFinishedMatchesAsDuprCsv(filename = null, options = {}) {
  const q = query(
    collection(db, MATCHES_COLLECTION),
    where('status', '==', MATCH_STATUS.COMPLETED)
  );
  const snapshot = await getDocs(q);
  const finished = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  return downloadDuprCsv(finished, filename, options);
}

// ==========================================
// 5. SESSION MANAGEMENT & FRESH START
// ==========================================

const SYSTEM_COLLECTION = 'system';
const CURRENT_SESSION_DOC = 'currentSession';

/**
 * Deletes all documents in a Firestore collection in batches of 400
 */
export async function clearCollection(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + 400);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Subscribes to real-time updates for the current session metadata
 */
export function subscribeCurrentSession(callback, onError) {
  const sessionDocRef = doc(db, SYSTEM_COLLECTION, CURRENT_SESSION_DOC);
  return onSnapshot(
    sessionDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() });
      } else {
        callback(null);
      }
    },
    onError
  );
}

/**
 * Resets the current meet-up:
 * 1. Permanently clears all existing players and matches.
 * 2. Initializes the new session document.
 * 3. Optionally loads the new Reclub JSON attendees list.
 */
export async function resetSessionAndStartFresh({
  sessionName = null,
  courtCount = 2,
  reclubJson = null
} = {}) {
  const now = new Date();
  const defaultName = `Open Play - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const finalName = (sessionName || '').trim() || defaultName;

  // 1. Wipe all existing players & matches
  await clearCollection(PLAYERS_COLLECTION);
  await clearCollection(MATCHES_COLLECTION);

  // 2. Set new session metadata
  const sessionDocRef = doc(db, SYSTEM_COLLECTION, CURRENT_SESSION_DOC);
  await setDoc(sessionDocRef, {
    name: finalName,
    courtCount: Math.max(1, Number(courtCount) || 2),
    status: 'active',
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 3. Import new players if Reclub JSON was provided
  let importedPlayers = [];
  if (reclubJson && reclubJson.trim()) {
    importedPlayers = await importReclubPlayers(reclubJson.trim());
  }

  return {
    sessionName: finalName,
    courtCount: Math.max(1, Number(courtCount) || 2),
    importedPlayersCount: importedPlayers.length
  };
}
