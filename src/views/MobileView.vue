<template>
  <div class="flex-1 bg-slate-950 text-slate-100 flex flex-col max-w-lg mx-auto w-full pb-16 min-h-screen">
    <!-- Mobile Sticky Top Bar -->
    <header class="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 flex flex-col gap-3 shadow-md">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="text-2xl">🏓</span>
          <div>
            <h1 class="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              Pickleball Live View
            </h1>
            <div class="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Sync Active</span>
            </div>
          </div>
        </div>

        <!-- Quick Summary Badge -->
        <div class="bg-slate-800 border border-slate-700/80 px-2.5 py-1 rounded-xl text-right">
          <span class="text-[10px] text-slate-400 block font-medium">In Queue</span>
          <span class="text-sm font-bold text-emerald-400 font-mono">{{ activeQueue.length }}</span>
        </div>
      </div>

      <!-- Quick Finder: 'Find My Spot' -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 Type your name to find queue spot..."
          class="w-full bg-slate-950/80 border border-slate-700/90 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-3 top-2 text-slate-400 text-xs hover:text-white"
        >
          ✕
        </button>
      </div>

      <!-- My Spot Highlight Banner (if match found) -->
      <div
        v-if="myPlayerInfo"
        class="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs animate-in fade-in"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-lg">👋</span>
          <div class="truncate">
            <span class="font-bold text-white block truncate">{{ myPlayerInfo.name }}</span>
            <span class="text-[11px] text-emerald-300">
              {{ myPlayerInfo.message }}
            </span>
          </div>
        </div>
        <div v-if="myPlayerInfo.position" class="text-right shrink-0">
          <span class="text-[10px] text-slate-400 block">Position</span>
          <span class="text-base font-extrabold text-emerald-400 font-mono">#{{ myPlayerInfo.position }}</span>
        </div>
      </div>

      <!-- Segmented Navigation Tabs -->
      <nav class="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          @click="activeTab = 'courts'"
          class="py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
          :class="activeTab === 'courts' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
        >
          <span>🏟️ Courts</span>
          <span v-if="inProgressMatches.length > 0" class="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-mono">
            {{ inProgressMatches.length }}
          </span>
        </button>

        <button
          @click="activeTab = 'queue'"
          class="py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
          :class="activeTab === 'queue' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
        >
          <span>⏱️ Queue</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-mono">
            {{ activeQueue.length }}
          </span>
        </button>

        <button
          @click="activeTab = 'standings'"
          class="py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
          :class="activeTab === 'standings' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
        >
          <span>🏆 Standings</span>
        </button>
      </nav>
    </header>

    <!-- TAB 1: Live Courts View -->
    <main v-if="activeTab === 'courts'" class="p-4 flex flex-col gap-4">
      <div v-if="inProgressMatches.length === 0" class="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 flex flex-col items-center gap-3">
        <span class="text-3xl">🎾</span>
        <h3 class="text-sm font-bold text-white">No Matches Currently Playing</h3>
        <p class="text-xs text-slate-400">
          The court coordinator will start the next match shortly. Check the queue tab to see who is on deck!
        </p>
      </div>

      <!-- Live Match Cards -->
      <div
        v-for="match in inProgressMatches"
        :key="match.id"
        class="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col"
      >
        <!-- Court Header & Live Timer -->
        <div class="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="font-extrabold text-white text-sm">{{ match.courtName || 'Court' }}</span>
          </div>

          <!-- Live Timer -->
          <div class="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-xs font-bold text-emerald-400">
            <svg class="w-3.5 h-3.5 text-emerald-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ getElapsedTime(match) }}</span>
          </div>
        </div>

        <!-- Court Matchup -->
        <div class="p-4 flex flex-col gap-3">
          <!-- Team 1 -->
          <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Team 1</span>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-white">
                <span v-for="(p, i) in match.team1" :key="p.id || p.name">
                  {{ p.name }}<span v-if="i < match.team1.length - 1" class="text-slate-500 font-normal"> & </span>
                </span>
              </div>
            </div>
            <span class="text-xs font-mono text-slate-400 font-semibold bg-slate-900 px-2 py-1 rounded-md">
              Avg {{ getTeamAverage(match.team1) }}
            </span>
          </div>

          <div class="flex items-center justify-center">
            <span class="text-[10px] font-black tracking-widest text-slate-600 uppercase bg-slate-950 px-3 py-0.5 rounded-full border border-slate-800">
              VS
            </span>
          </div>

          <!-- Team 2 -->
          <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Team 2</span>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-white">
                <span v-for="(p, i) in match.team2" :key="p.id || p.name">
                  {{ p.name }}<span v-if="i < match.team2.length - 1" class="text-slate-500 font-normal"> & </span>
                </span>
              </div>
            </div>
            <span class="text-xs font-mono text-slate-400 font-semibold bg-slate-900 px-2 py-1 rounded-md">
              Avg {{ getTeamAverage(match.team2) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Recent Results Card Section -->
      <div v-if="completedMatches.length > 0" class="mt-2 flex flex-col gap-3">
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Recent Match Results</span>
          <span class="font-normal lowercase">({{ completedMatches.length }} finished)</span>
        </h3>

        <div class="space-y-2">
          <div
            v-for="cm in completedMatches.slice(0, 3)"
            :key="cm.id"
            class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
          >
            <div class="min-w-0">
              <div class="font-medium text-white flex items-center gap-1.5">
                <span :class="cm.winningTeam === 1 ? 'text-emerald-400 font-bold' : 'text-slate-300'">
                  {{ (cm.team1 || []).map(p => p.name).join(' & ') }}
                </span>
                <span class="text-slate-500">vs</span>
                <span :class="cm.winningTeam === 2 ? 'text-emerald-400 font-bold' : 'text-slate-300'">
                  {{ (cm.team2 || []).map(p => p.name).join(' & ') }}
                </span>
              </div>
              <span class="text-[10px] text-slate-500">{{ cm.courtName || 'Court' }}</span>
            </div>

            <div class="text-right font-mono font-bold text-sm text-emerald-400">
              {{ cm.score ? `${cm.score.team1} - ${cm.score.team2}` : 'Done' }}
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- TAB 2: 'Up-Next' Queue View -->
    <main v-else-if="activeTab === 'queue'" class="p-4 flex flex-col gap-4">
      <!-- 'On Deck' Highlight (Next 4 active players) -->
      <div v-if="eligibleQueue.length >= 4" class="bg-gradient-to-br from-emerald-900/40 via-slate-900 to-teal-900/30 p-4 rounded-2xl border border-emerald-500/40 shadow-lg flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-base">🔥</span>
            <span class="text-xs font-bold text-emerald-300 uppercase tracking-wider">Next 4 On Deck</span>
          </div>
          <span class="text-[11px] text-emerald-400 font-medium">Active players ready</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="(player) in eligibleQueue.slice(0, 4)"
            :key="player.id"
            class="bg-slate-950/80 p-2.5 rounded-xl border border-emerald-500/20 flex items-center gap-2.5"
          >
            <span class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs font-mono">
              #{{ getPlayerQueueIndex(player.id) }}
            </span>
            <div class="min-w-0">
              <span class="font-bold text-xs text-white block truncate">{{ player.name }}</span>
              <span class="text-[10px] text-slate-400">Rating {{ player.rating || 3.5 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Full Queue List -->
      <div class="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        <div class="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <span class="text-xs font-bold text-white uppercase tracking-wider">
            Waiting Queue ({{ waitingQueue.length }})
          </span>
          <span class="text-[11px] text-slate-400">{{ eligibleQueue.length }} active · {{ waitingQueue.length - eligibleQueue.length }} resting</span>
        </div>

        <div v-if="waitingQueue.length === 0" class="p-8 text-center text-slate-400 text-xs">
          Queue is currently empty!
        </div>

        <div class="divide-y divide-slate-800">
          <div
            v-for="(player, idx) in waitingQueue"
            :key="player.id"
            class="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-850/50 transition-colors"
            :class="[
              isMyPlayer(player) ? 'bg-emerald-950/30 border-l-4 border-emerald-400' : '',
              player.status === 'resting' ? 'opacity-70 bg-slate-950/40' : ''
            ]"
          >
            <div class="flex items-center gap-3 min-w-0">
              <!-- Persistent Queue Number Badge -->
              <span
                class="w-8 h-8 rounded-xl border flex items-center justify-center font-extrabold text-sm font-mono"
                :class="
                  player.status === 'active'
                    ? 'bg-slate-800 border-slate-700 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                "
              >
                #{{ idx + 1 }}
              </span>

              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white truncate">{{ player.name }}</span>
                  <span v-if="player.status === 'resting'" class="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 font-semibold rounded border border-amber-500/30">
                    💤 Resting
                  </span>
                  <span v-if="isMyPlayer(player)" class="text-[10px] px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-bold rounded">YOU</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>Rating: {{ player.rating || 3.5 }}</span>
                  <span>·</span>
                  <span>Played: {{ player.gamesPlayed || 0 }}</span>
                </div>
              </div>
            </div>

            <!-- Est. Wait Badge -->
            <div class="text-right shrink-0">
              <span class="text-[10px] text-slate-500 block">Est. Wait</span>
              <span class="text-xs font-mono font-semibold" :class="player.status === 'resting' ? 'text-amber-400' : 'text-slate-300'">
                {{ player.status === 'resting' ? 'Resting' : getEstimatedWaitTime(idx) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- TAB 3: Session Standings View -->
    <main v-else-if="activeTab === 'standings'" class="p-4 flex flex-col gap-4">
      <div class="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        <div class="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 class="text-xs font-bold text-white uppercase tracking-wider">Session Leaderboard</h2>
            <p class="text-[10px] text-slate-400">Ranked by Wins & Point Differential</p>
          </div>
          <span class="text-xs font-mono font-bold text-emerald-400">{{ standingsList.length }} Players</span>
        </div>

        <div v-if="standingsList.length === 0" class="p-8 text-center text-slate-400 text-xs">
          Standings will appear once matches are completed.
        </div>

        <div class="divide-y divide-slate-800">
          <div
            v-for="(player, rank) in standingsList"
            :key="player.id"
            class="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-850/50 transition-colors"
            :class="isMyPlayer(player) ? 'bg-emerald-950/30 border-l-4 border-emerald-400' : ''"
          >
            <!-- Rank & Name -->
            <div class="flex items-center gap-3 min-w-0">
              <!-- Medal or Rank -->
              <span class="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm font-mono shrink-0"
                :class="
                  rank === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                  rank === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40' :
                  rank === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40' :
                  'bg-slate-800 text-slate-400'
                "
              >
                {{ rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1 }}
              </span>

              <div class="min-w-0">
                <span class="font-bold text-sm text-white block truncate">{{ player.name }}</span>
                <span class="text-[11px] text-slate-400">
                  Diff: <strong :class="player.pointDifferential >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                    {{ player.pointDifferential >= 0 ? `+${player.pointDifferential}` : player.pointDifferential }}
                  </strong>
                  · Win {{ player.winRate }}%
                </span>
              </div>
            </div>

            <!-- Stats (W - L) -->
            <div class="text-right shrink-0">
              <span class="text-sm font-bold text-emerald-400 font-mono">
                {{ player.wins }}W - {{ player.losses }}L
              </span>
              <span class="text-[10px] text-slate-400 block">{{ player.gamesPlayed }} played</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  subscribePlayers,
  subscribeMatches,
  getWaitingQueue,
  getEligibleQueue,
  getActiveQueue,
  computeStandings
} from '../utils/queueEngine.js'

// Navigation
const activeTab = ref('courts') // 'courts' | 'queue' | 'standings'
const searchQuery = ref('')

// Real-time Firestore state
const players = ref([])
const matches = ref([])

// Live timer tick
const nowSeconds = ref(Math.floor(Date.now() / 1000))
let timerInterval = null

// Subscriptions
let unsubPlayers = null
let unsubMatches = null

// Computed
const inProgressMatches = computed(() => {
  return matches.value.filter((m) => m.status === 'in_progress')
})

// Full waiting queue (both active & resting in persistent order)
const waitingQueue = computed(() => getWaitingQueue(players.value, inProgressMatches.value))

// Active players eligible for next games
const eligibleQueue = computed(() => getEligibleQueue(players.value, inProgressMatches.value))

// Display all waiting players under Queue tab
const activeQueue = waitingQueue

const completedMatches = computed(() => {
  return matches.value.filter((m) => m.status === 'completed')
})

const standingsList = computed(() => {
  return computeStandings(players.value, completedMatches.value)
})

function getPlayerQueueIndex(playerId) {
  const idx = waitingQueue.value.findIndex((p) => p.id === playerId)
  return idx >= 0 ? idx + 1 : '-'
}

// Search / 'Find My Spot' helper
const myPlayerInfo = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return null

  const match = players.value.find((p) => (p.name || '').toLowerCase().includes(query))
  if (!match) return null

  // Check if playing on court
  const activeCourt = inProgressMatches.value.find((m) => {
    const onT1 = (m.team1 || []).some((p) => p.id === match.id)
    const onT2 = (m.team2 || []).some((p) => p.id === match.id)
    return onT1 || onT2
  })

  if (activeCourt) {
    return {
      name: match.name,
      message: `Currently playing on ${activeCourt.courtName || 'Court'}!`,
      position: null
    }
  }

  const queueIdx = waitingQueue.value.findIndex((p) => p.id === match.id)
  if (match.status === 'resting') {
    return {
      name: match.name,
      message: `Resting (#${queueIdx >= 0 ? queueIdx + 1 : '-'} in line). Skipped for games until you toggle Active.`,
      position: queueIdx >= 0 ? queueIdx + 1 : null
    }
  }

  if (queueIdx >= 0) {
    const est = getEstimatedWaitTime(queueIdx)
    return {
      name: match.name,
      message: `You are in line! Approx. ${est} wait.`,
      position: queueIdx + 1
    }
  }

  return {
    name: match.name,
    message: `Status: ${match.status || 'Active'}`,
    position: null
  }
})

function isMyPlayer(player) {
  if (!searchQuery.value.trim()) return false
  return (player.name || '').toLowerCase().includes(searchQuery.value.trim().toLowerCase())
}

function getTeamAverage(team = []) {
  if (!team || team.length === 0) return '3.5'
  const sum = team.reduce((acc, p) => acc + Number(p.rating || 3.5), 0)
  return (sum / team.length).toFixed(1)
}

function getEstimatedWaitTime(queueIndex) {
  const courtsCount = Math.max(1, inProgressMatches.value.length || 1)
  // Each match approx 12 mins. 4 players per match.
  const minutes = Math.floor((queueIndex / (courtsCount * 4)) * 12)
  if (minutes < 3) return 'Next up!'
  return `~${minutes}m`
}

function getElapsedTime(match) {
  if (!match) return '00:00'
  let startMs = Date.now()
  if (match.startedAt) {
    if (typeof match.startedAt.toDate === 'function') {
      startMs = match.startedAt.toDate().getTime()
    } else if (match.startedAt.seconds) {
      startMs = match.startedAt.seconds * 1000
    } else {
      startMs = new Date(match.startedAt).getTime()
    }
  }

  const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
  const minutes = Math.floor(elapsedSec / 60)
  const seconds = elapsedSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

onMounted(() => {
  unsubPlayers = subscribePlayers(
    (data) => {
      players.value = data
    },
    (err) => console.error('MobileView players error:', err)
  )

  unsubMatches = subscribeMatches(
    (data) => {
      matches.value = data
    },
    (err) => console.error('MobileView matches error:', err)
  )

  timerInterval = setInterval(() => {
    nowSeconds.value = Math.floor(Date.now() / 1000)
  }, 1000)
})

onUnmounted(() => {
  if (unsubPlayers) unsubPlayers()
  if (unsubMatches) unsubMatches()
  if (timerInterval) clearInterval(timerInterval)
})
</script>
