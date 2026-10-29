<template>
  <div class="flex-1 bg-slate-900 text-slate-100 p-4 md:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Top Action Bar (iPad Touch Optimized) -->
    <div class="flex flex-wrap items-center justify-between gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 shadow-lg">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-2xl shadow-md">
          🏓
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Court Coordinator Admin
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              iPad View
            </span>
          </h1>
          <p class="text-xs text-slate-400">
            {{ waitingQueue.length }} in queue ({{ eligibleQueue.length }} ready) · {{ players.length }} total players · {{ inProgressMatches.length }} active court(s)
          </p>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center flex-wrap gap-2.5">
        <!-- Show QR Code Button -->
        <button
          @click="showQrModal = true"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-all shadow-md active:scale-95"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          Show QR Code
        </button>

        <!-- Add Walk-in Player -->
        <button
          @click="showAddPlayerModal = true"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow-md active:scale-95"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Walk-in
        </button>

        <!-- Import Reclub JSON -->
        <button
          @click="showReclubModal = true"
          class="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 rounded-xl font-medium text-sm transition-all border border-slate-600"
        >
          📋 Import Reclub
        </button>

        <!-- Export DUPR CSV -->
        <button
          @click="handleExportDupr"
          :disabled="completedMatches.length === 0"
          class="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-xl font-medium text-sm transition-all border border-slate-600"
          title="Download DUPR match upload CSV"
        >
          📥 DUPR CSV ({{ completedMatches.length }})
        </button>
      </div>
    </div>

    <!-- Main iPad Layout: 2 Columns (Courts on Left, Queue & Players on Right) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- LEFT: Courts & Fast Match Control (7 cols) -->
      <section class="lg:col-span-7 flex flex-col gap-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <span>🏟️ Live Courts</span>
            <span class="text-xs font-normal text-slate-400">({{ configuredCourts.length }} configured)</span>
          </h2>

          <div class="flex items-center gap-2 text-xs">
            <span class="text-slate-400">Pairing Mode:</span>
            <button
              @click="pairingMode = pairingMode === 'balanced' ? 'random' : 'balanced'"
              class="px-2.5 py-1 rounded-lg border border-slate-700 font-semibold transition-colors"
              :class="pairingMode === 'balanced' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-purple-500/20 text-purple-300 border-purple-500/40'"
            >
              {{ pairingMode === 'balanced' ? '⚖️ Balanced Rating' : '🎲 Random' }}
            </button>
          </div>
        </div>

        <!-- Court Cards Grid -->
        <div class="grid grid-cols-1 gap-6">
          <div
            v-for="court in courtsWithMatches"
            :key="court.id"
            class="bg-slate-800/90 rounded-2xl border border-slate-700/80 shadow-xl overflow-hidden flex flex-col"
          >
            <!-- Court Header with Live Timer and Auto-Fill Toggle -->
            <div class="px-5 py-3.5 bg-slate-800 border-b border-slate-700/70 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-full" :class="court.activeMatch ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'"></span>
                <span class="font-bold text-white text-base">{{ court.name }}</span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="court.activeMatch ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'"
                >
                  {{ court.activeMatch ? 'LIVE IN PROGRESS' : 'EMPTY / READY' }}
                </span>
              </div>

              <div class="flex items-center gap-2.5">
                <!-- Auto-Fill Queue Toggle -->
                <button
                  v-if="court.activeMatch"
                  @click="toggleCourtAutoFill(court.id)"
                  class="text-[11px] px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors"
                  :class="
                    courtAutoFill[court.id] !== false
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  "
                  :title="courtAutoFill[court.id] !== false ? 'Auto-filling next game from queue on score submission' : 'Will NOT pull from queue when game finishes'"
                >
                  <span>{{ courtAutoFill[court.id] !== false ? '🔄 Auto-Fill: ON' : '🛑 Auto-Fill: OFF' }}</span>
                </button>

                <!-- Live Elapsed Timer -->
                <div v-if="court.activeMatch" class="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700/60 font-mono text-sm font-bold text-emerald-400">
                  <svg class="w-4 h-4 text-emerald-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ getElapsedTime(court.activeMatch) }}</span>
                </div>
              </div>
            </div>

            <!-- Active Match Body -->
            <div v-if="court.activeMatch" class="p-5 flex flex-col gap-5">
              <!-- Teams Matchup -->
              <div class="grid grid-cols-5 gap-3 items-center">
                <!-- Team 1 -->
                <div class="col-span-2 bg-slate-900/80 rounded-xl p-3.5 border border-slate-700/60 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Team 1</span>
                    <span class="text-[11px] text-slate-400">Avg {{ getTeamAverageRating(court.activeMatch.team1) }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <div
                      v-for="player in court.activeMatch.team1"
                      :key="player.id || player.name"
                      class="flex items-center justify-between text-sm"
                    >
                      <span class="font-semibold text-slate-100 truncate">{{ player.name }}</span>
                      <div class="flex items-center gap-1">
                        <span v-if="(player.consecutiveGames || 0) >= 1" class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold" title="Consecutive game">
                          🔥 G2
                        </span>
                        <span class="text-xs text-slate-400">{{ player.rating || 3.5 }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- VS Divider -->
                <div class="col-span-1 flex flex-col items-center justify-center">
                  <span class="text-xs font-black text-slate-500 tracking-wider">VS</span>
                </div>

                <!-- Team 2 -->
                <div class="col-span-2 bg-slate-900/80 rounded-xl p-3.5 border border-slate-700/60 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold uppercase tracking-wider text-teal-400">Team 2</span>
                    <span class="text-[11px] text-slate-400">Avg {{ getTeamAverageRating(court.activeMatch.team2) }}</span>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <div
                      v-for="player in court.activeMatch.team2"
                      :key="player.id || player.name"
                      class="flex items-center justify-between text-sm"
                    >
                      <span class="font-semibold text-slate-100 truncate">{{ player.name }}</span>
                      <div class="flex items-center gap-1">
                        <span v-if="(player.consecutiveGames || 0) >= 1" class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold" title="Consecutive game">
                          🔥 G2
                        </span>
                        <span class="text-xs text-slate-400">{{ player.rating || 3.5 }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Fast Score Submission Buttons -->
              <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-700/80 flex flex-col gap-3">
                <div class="flex items-center justify-between text-xs text-slate-400">
                  <span class="font-semibold uppercase tracking-wider text-slate-300">Fast Score Submission</span>
                  <span>Select winning score & team</span>
                </div>

                <!-- Fast Score Grid (11-7, 11-9) -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <!-- Team 1 wins 11-7 -->
                  <button
                    @click="handleScoreSubmission(court.activeMatch, 1, 11, 7)"
                    :disabled="submittingMatchId === court.activeMatch.id"
                    class="py-3 px-3 bg-emerald-600/90 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl font-bold text-sm text-white flex flex-col items-center justify-center gap-0.5 shadow transition-all active:scale-95 border border-emerald-500/40"
                  >
                    <span class="text-xs opacity-80 font-normal">Team 1 Wins</span>
                    <span class="text-base tracking-wide">11 — 7</span>
                  </button>

                  <!-- Team 1 wins 11-9 -->
                  <button
                    @click="handleScoreSubmission(court.activeMatch, 1, 11, 9)"
                    :disabled="submittingMatchId === court.activeMatch.id"
                    class="py-3 px-3 bg-emerald-700/90 hover:bg-emerald-600 active:bg-emerald-800 rounded-xl font-bold text-sm text-white flex flex-col items-center justify-center gap-0.5 shadow transition-all active:scale-95 border border-emerald-600/40"
                  >
                    <span class="text-xs opacity-80 font-normal">Team 1 Wins</span>
                    <span class="text-base tracking-wide">11 — 9</span>
                  </button>

                  <!-- Team 2 wins 7-11 -->
                  <button
                    @click="handleScoreSubmission(court.activeMatch, 2, 7, 11)"
                    :disabled="submittingMatchId === court.activeMatch.id"
                    class="py-3 px-3 bg-teal-600/90 hover:bg-teal-500 active:bg-teal-700 rounded-xl font-bold text-sm text-white flex flex-col items-center justify-center gap-0.5 shadow transition-all active:scale-95 border border-teal-500/40"
                  >
                    <span class="text-xs opacity-80 font-normal">Team 2 Wins</span>
                    <span class="text-base tracking-wide">7 — 11</span>
                  </button>

                  <!-- Team 2 wins 9-11 -->
                  <button
                    @click="handleScoreSubmission(court.activeMatch, 2, 9, 11)"
                    :disabled="submittingMatchId === court.activeMatch.id"
                    class="py-3 px-3 bg-teal-700/90 hover:bg-teal-600 active:bg-teal-800 rounded-xl font-bold text-sm text-white flex flex-col items-center justify-center gap-0.5 shadow transition-all active:scale-95 border border-teal-600/40"
                  >
                    <span class="text-xs opacity-80 font-normal">Team 2 Wins</span>
                    <span class="text-base tracking-wide">9 — 11</span>
                  </button>
                </div>

                <!-- Custom Score Inputs & Action Buttons Row -->
                <div class="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800/80 gap-3">
                  <div class="flex items-center gap-2 text-xs text-slate-400">
                    <span>Score:</span>
                    <input
                      v-model.number="customScores[court.id].t1"
                      type="number"
                      min="0"
                      max="30"
                      class="w-12 bg-slate-950 border border-slate-700 rounded-lg text-center py-1 font-bold text-white text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                    <span>-</span>
                    <input
                      v-model.number="customScores[court.id].t2"
                      type="number"
                      min="0"
                      max="30"
                      class="w-12 bg-slate-950 border border-slate-700 rounded-lg text-center py-1 font-bold text-white text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- Submit & Next Match -->
                    <button
                      @click="handleCustomScoreSubmit(court.activeMatch, court.id, true)"
                      :disabled="submittingMatchId === court.activeMatch.id"
                      class="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-600"
                    >
                      Submit & Next
                    </button>

                    <!-- End Game (No Queue Pull) Button -->
                    <button
                      @click="handleEndGameWithoutQueue(court.activeMatch, court.id)"
                      :disabled="submittingMatchId === court.activeMatch.id"
                      class="px-3.5 py-1.5 bg-amber-600/90 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 border border-amber-500/40 flex items-center gap-1.5 shadow-sm"
                      title="Submit final score and end game without pulling new players from queue"
                    >
                      <span>🏁 End Game (No Queue Pull)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty Court Prompt / Start Next Match -->
            <div v-else class="p-8 flex flex-col items-center justify-center gap-4 text-center">
              <div class="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-400 text-xl">
                ⏳
              </div>
              <div>
                <h3 class="font-bold text-white text-base">Court is Open</h3>
                <p class="text-xs text-slate-400 max-w-sm mt-0.5">
                  {{ activeQueue.length >= 4 ? '4 or more players are waiting in queue. Start a match now!' : `Need 4 active players to start. Current queue: ${activeQueue.length}` }}
                </p>
              </div>

              <button
                @click="handleStartFreshMatch(court.id, court.name)"
                :disabled="activeQueue.length < 4 || isStartingMatch"
                class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <span>▶️ Start Match on {{ court.name }}</span>
                <span v-if="activeQueue.length >= 4" class="text-xs opacity-80">(Auto-pair 4)</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Add Another Court Button -->
        <button
          v-if="configuredCourts.length < 4"
          @click="handleAddCourt"
          class="py-3 px-4 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          ➕ Add Court {{ configuredCourts.length + 1 }}
        </button>
      </section>

      <!-- RIGHT: Waiting Queue & Active / Resting Toggles (5 cols) -->
      <section class="lg:col-span-5 flex flex-col gap-6">
        <div class="bg-slate-800/90 rounded-2xl border border-slate-700/80 shadow-xl overflow-hidden flex flex-col">
          <!-- Queue Header -->
          <div class="px-5 py-4 bg-slate-800 border-b border-slate-700/70 flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-white flex items-center gap-2">
                <span>⏱️ Waiting Queue</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">
                  {{ waitingQueue.length }} in Line ({{ eligibleQueue.length }} Ready)
                </span>
              </h2>
              <p class="text-[11px] text-slate-400 mt-0.5">Persistent queue numbers · Resting players keep their spot but are skipped</p>
            </div>

            <!-- Queue Filter / Quick Stats -->
            <div class="flex items-center gap-1.5 text-xs text-slate-400">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Active</span>
              <span class="w-2 h-2 rounded-full bg-amber-500 ml-2"></span>
              <span>Resting (Skipped)</span>
            </div>
          </div>

          <!-- Queue List -->
          <div class="divide-y divide-slate-700/50 max-h-[580px] overflow-y-auto">
            <div
              v-if="players.length === 0"
              class="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2"
            >
              <span>No players in the session yet.</span>
              <button
                @click="showAddPlayerModal = true"
                class="text-xs text-emerald-400 font-semibold hover:underline"
              >
                + Add walk-in player
              </button>
            </div>

            <div
              v-for="(player, idx) in sortedAllPlayers"
              :key="player.id"
              class="p-3.5 hover:bg-slate-700/30 transition-colors flex items-center justify-between gap-3"
              :class="player.status === 'resting' ? 'opacity-80 bg-slate-900/40' : ''"
            >
              <!-- Left: Queue Number & Name -->
              <div class="flex items-center gap-3 min-w-0">
                <!-- Position Badge (Shows for all waiting players, preserving queue number!) -->
                <div
                  v-if="!isPlayerOnCourt(player.id)"
                  class="w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs font-mono"
                  :class="
                    player.status === 'active'
                      ? 'bg-slate-700/80 border-slate-600/70 text-emerald-400'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  "
                >
                  #{{ getPlayerQueueIndex(player.id) }}
                </div>
                <div
                  v-else
                  class="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px] text-emerald-300 font-bold"
                  :title="'Playing on ' + (getPlayerCourtName(player.id) || 'Court')"
                >
                  🎾
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-slate-100 truncate">{{ player.name }}</span>
                    <span v-if="player.status === 'resting'" class="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-medium">
                      💤 Resting (Skipped)
                    </span>
                    <span v-if="player.duprId" class="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.2 rounded">
                      {{ player.duprId }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>Rating: <strong class="text-slate-300">{{ player.rating || 3.5 }}</strong></span>
                    <span>·</span>
                    <span>Games: {{ player.gamesPlayed || 0 }}</span>
                    <span v-if="isPlayerOnCourt(player.id)" class="text-emerald-400 font-medium">· Playing ({{ getPlayerCourtName(player.id) }})</span>
                  </div>
                </div>
              </div>

              <!-- Right: Interactive Status Toggle (Active / Resting) -->
              <div class="flex items-center gap-2 shrink-0">
                <button
                  @click="handleToggleStatus(player)"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                  :class="
                    player.status === 'active'
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  "
                >
                  <span class="w-2 h-2 rounded-full" :class="player.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                  <span>{{ player.status === 'active' ? 'Active' : 'Resting' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- MODAL 1: Add Manual Walk-In Player -->
    <div
      v-if="showAddPlayerModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div class="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-700">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>➕ Add Walk-in Player</span>
          </h3>
          <button @click="showAddPlayerModal = false" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <form @submit.prevent="handleSubmitWalkIn" class="flex flex-col gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Player Name *</label>
            <input
              v-model="newPlayer.name"
              type="text"
              required
              placeholder="e.g. Alex Morgan"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">DUPR / Skill Rating</label>
              <input
                v-model.number="newPlayer.rating"
                type="number"
                step="0.05"
                min="1.0"
                max="7.0"
                placeholder="3.50"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">DUPR ID (Optional)</label>
              <input
                v-model="newPlayer.duprId"
                type="text"
                placeholder="e.g. ABC1234"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Email (Optional)</label>
            <input
              v-model="newPlayer.email"
              type="email"
              placeholder="player@example.com"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
            <button
              type="button"
              @click="showAddPlayerModal = false"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSubmittingPlayer"
              class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              {{ isSubmittingPlayer ? 'Saving...' : 'Add to Queue' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 2: Show QR Code (Points to /view) -->
    <div
      v-if="showQrModal"
      class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div class="bg-slate-800 border border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center gap-5 text-center">
        <div class="w-full flex items-center justify-between">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>📲 Player Live View</span>
          </h3>
          <button @click="showQrModal = false" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <!-- QR Code Canvas -->
        <div class="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center">
          <qrcode-vue :value="qrCodeUrl" :size="220" level="H" />
        </div>

        <div class="flex flex-col gap-1.5">
          <p class="text-sm font-semibold text-slate-200">Scan to Open Live Mobile View</p>
          <p class="text-xs text-slate-400">
            Players can scan this code with their camera to track live court scores, timers & queue position in real time.
          </p>
        </div>

        <!-- Link & Copy Button -->
        <div class="w-full flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700 text-xs">
          <span class="truncate text-slate-300 flex-1 text-left px-1 font-mono">{{ qrCodeUrl }}</span>
          <button
            @click="handleCopyLink"
            class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shrink-0 transition-colors"
          >
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 3: Import Reclub JSON -->
    <div
      v-if="showReclubModal"
      class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div class="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-700">
          <h3 class="text-base font-bold text-white">📋 Import Reclub JSON List</h3>
          <button @click="showReclubModal = false" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <p class="text-xs text-slate-300">
          Paste the JSON export or attendees array from Reclub. Player ratings, DUPR IDs, and names will be automatically extracted and loaded into the queue.
        </p>

        <textarea
          v-model="reclubJsonInput"
          rows="8"
          placeholder='[&#10;  { "name": "Sarah Miller", "rating": 3.75, "duprId": "DPR123" },&#10;  { "name": "Tom Chen", "rating": 4.10 }&#10;]'
          class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        ></textarea>

        <div v-if="reclubError" class="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
          {{ reclubError }}
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            @click="showReclubModal = false"
            class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            @click="handleImportReclub"
            :disabled="isImportingReclub || !reclubJsonInput.trim()"
            class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            {{ isImportingReclub ? 'Importing...' : 'Import Players' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import QrcodeVue from 'qrcode.vue'
import {
  subscribePlayers,
  subscribeMatches,
  addWalkInPlayer,
  importReclubPlayers,
  updatePlayerStatus,
  startMatch,
  completeMatch,
  endMatchWithoutRotation,
  pairFirstGame,
  getWaitingQueue,
  getEligibleQueue,
  getActiveQueue,
  downloadFinishedMatchesAsDuprCsv,
  PLAYER_STATUS
} from '../utils/queueEngine.js'

// State
const players = ref([])
const matches = ref([])
const pairingMode = ref('balanced') // 'balanced' | 'random'
const submittingMatchId = ref(null)
const isStartingMatch = ref(false)

// Configured Courts
const configuredCourts = ref([
  { id: 'court-1', name: 'Court 1' },
  { id: 'court-2', name: 'Court 2' }
])

const customScores = reactive({
  'court-1': { t1: 11, t2: 9 },
  'court-2': { t1: 11, t2: 9 },
  'court-3': { t1: 11, t2: 9 },
  'court-4': { t1: 11, t2: 9 }
})

// Auto-Fill Next Game toggle per court (default: true)
const courtAutoFill = reactive({
  'court-1': true,
  'court-2': true,
  'court-3': true,
  'court-4': true
})

function toggleCourtAutoFill(courtId) {
  courtAutoFill[courtId] = courtAutoFill[courtId] === false ? true : false
}

// Modals
const showAddPlayerModal = ref(false)
const isSubmittingPlayer = ref(false)
const newPlayer = reactive({
  name: '',
  rating: 3.5,
  duprId: '',
  email: ''
})

const showQrModal = ref(false)
const copied = ref(false)

const showReclubModal = ref(false)
const reclubJsonInput = ref('')
const reclubError = ref('')
const isImportingReclub = ref(false)

// Live timer tick
const nowSeconds = ref(Math.floor(Date.now() / 1000))
let timerInterval = null

// URL for QR Code pointing to /view
const qrCodeUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/view`
  }
  return 'http://localhost:5173/view'
})

// Computed
const inProgressMatches = computed(() => {
  return matches.value.filter((m) => m.status === 'in_progress')
})

// Full waiting queue (both active and resting players, maintaining persistent queue order)
const waitingQueue = computed(() => getWaitingQueue(players.value, inProgressMatches.value))

// Active players eligible for games
const eligibleQueue = computed(() => getEligibleQueue(players.value, inProgressMatches.value))

// Backward compatible alias
const activeQueue = eligibleQueue

const completedMatches = computed(() => {
  return matches.value.filter((m) => m.status === 'completed')
})

function isPlayerOnCourt(playerId) {
  return inProgressMatches.value.some((m) =>
    (m.team1 || []).some((p) => p.id === playerId) ||
    (m.team2 || []).some((p) => p.id === playerId)
  )
}

function getPlayerCourtName(playerId) {
  const match = inProgressMatches.value.find((m) =>
    (m.team1 || []).some((p) => p.id === playerId) ||
    (m.team2 || []).some((p) => p.id === playerId)
  )
  return match ? match.courtName : null
}

// Associate active match with each configured court
const courtsWithMatches = computed(() => {
  return configuredCourts.value.map((court) => {
    // If multiple in_progress matches exist for this court, pick the newest one
    const courtMatches = inProgressMatches.value.filter((m) => m.courtId === court.id)
    return {
      ...court,
      activeMatch: courtMatches[0] || null
    }
  })
})

// Replace configuredCourts display getter
const configuredCourtsDisplay = courtsWithMatches

const sortedAllPlayers = computed(() => {
  return [...players.value].sort((a, b) => {
    const aOnCourt = isPlayerOnCourt(a.id)
    const bOnCourt = isPlayerOnCourt(b.id)

    // 1. Waiting players (both active & resting) in persistent arrival order
    if (!aOnCourt && bOnCourt) return -1
    if (aOnCourt && !bOnCourt) return 1
    if (aOnCourt && bOnCourt) return 0

    return (a.queuePosition || 0) - (b.queuePosition || 0)
  })
})

function getPlayerQueueIndex(playerId) {
  const idx = waitingQueue.value.findIndex((p) => p.id === playerId)
  return idx >= 0 ? idx + 1 : '-'
}

function getTeamAverageRating(team = []) {
  if (!team || team.length === 0) return '3.50'
  const sum = team.reduce((acc, p) => acc + Number(p.rating || 3.5), 0)
  return (sum / team.length).toFixed(2)
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

// Handlers
async function handleToggleStatus(player) {
  const nextStatus = player.status === PLAYER_STATUS.ACTIVE ? PLAYER_STATUS.RESTING : PLAYER_STATUS.ACTIVE
  try {
    await updatePlayerStatus(player.id, nextStatus)
  } catch (err) {
    console.error('Failed to update status:', err)
  }
}

async function handleSubmitWalkIn() {
  if (!newPlayer.name.trim()) return
  isSubmittingPlayer.value = true
  try {
    await addWalkInPlayer({
      name: newPlayer.name.trim(),
      rating: newPlayer.rating || 3.5,
      duprId: newPlayer.duprId.trim(),
      email: newPlayer.email.trim()
    })
    newPlayer.name = ''
    newPlayer.rating = 3.5
    newPlayer.duprId = ''
    newPlayer.email = ''
    showAddPlayerModal.value = false
  } catch (err) {
    alert(`Error: ${err.message}`)
  } finally {
    isSubmittingPlayer.value = false
  }
}

async function handleImportReclub() {
  if (!reclubJsonInput.value.trim()) return
  reclubError.value = ''
  isImportingReclub.value = true
  try {
    const imported = await importReclubPlayers(reclubJsonInput.value.trim())
    alert(`Successfully imported ${imported.length} players from Reclub!`)
    reclubJsonInput.value = ''
    showReclubModal.value = false
  } catch (err) {
    reclubError.value = err.message
  } finally {
    isImportingReclub.value = false
  }
}

function handleAddCourt() {
  const nextNum = configuredCourts.value.length + 1
  configuredCourts.value.push({
    id: `court-${nextNum}`,
    name: `Court ${nextNum}`
  })
}

async function handleStartFreshMatch(courtId, courtName) {
  if (eligibleQueue.value.length < 4) {
    alert(`Need at least 4 active waiting players in queue to start a match! (Currently ${eligibleQueue.value.length} active, ${waitingQueue.value.length - eligibleQueue.value.length} resting)`)
    return
  }

  isStartingMatch.value = true
  try {
    // Pick the first 4 ACTIVE players from waiting queue, skipping any resting players!
    const four = []
    for (const p of waitingQueue.value) {
      if (four.length === 4) break
      if (p.status === PLAYER_STATUS.ACTIVE || p.status === undefined) {
        four.push(p)
      }
    }

    const { team1, team2 } = pairFirstGame(four, { mode: pairingMode.value })
    await startMatch({
      courtId,
      courtName,
      team1,
      team2
    })
  } catch (err) {
    alert(`Error starting match: ${err.message}`)
  } finally {
    isStartingMatch.value = false
  }
}

async function handleScoreSubmission(match, winningTeam, t1Score, t2Score, forceRotate = null) {
  if (!match || submittingMatchId.value) return
  submittingMatchId.value = match.id

  const shouldRotate = forceRotate !== null ? forceRotate : (courtAutoFill[match.courtId] !== false)

  try {
    const { rotation } = await completeMatch({
      matchId: match.id,
      winningTeamIndex: winningTeam,
      score: { team1: t1Score, team2: t2Score },
      currentPlayersList: players.value,
      balanceMode: pairingMode.value,
      rotateNext: shouldRotate
    })

    // If shouldRotate is enabled and nextMatch was formed from rotation, start the next match!
    if (shouldRotate && rotation && rotation.nextMatch) {
      await startMatch({
        courtId: match.courtId,
        courtName: match.courtName,
        team1: rotation.nextMatch.team1,
        team2: rotation.nextMatch.team2
      })
    }
  } catch (err) {
    alert(`Error recording match score: ${err.message}`)
  } finally {
    submittingMatchId.value = null
  }
}

async function handleCustomScoreSubmit(match, courtId, forceRotate = true) {
  if (!match) return
  const scores = customScores[courtId] || { t1: 11, t2: 9 }
  const winTeam = scores.t1 > scores.t2 ? 1 : 2
  await handleScoreSubmission(match, winTeam, scores.t1, scores.t2, forceRotate)
}

async function handleEndGameWithoutQueue(match, courtId) {
  if (!match || submittingMatchId.value) return
  const scores = customScores[courtId] || { t1: 11, t2: 9 }
  const winTeam = scores.t1 > scores.t2 ? 1 : 2
  await handleScoreSubmission(match, winTeam, scores.t1, scores.t2, false)
}

function handleCopyLink() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(qrCodeUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

async function handleExportDupr() {
  try {
    await downloadFinishedMatchesAsDuprCsv()
  } catch (err) {
    alert(`Error exporting DUPR CSV: ${err.message}`)
  }
}

// Lifecycle: Firestore Subscriptions & Timer
let unsubPlayers = null
let unsubMatches = null

onMounted(() => {
  unsubPlayers = subscribePlayers(
    (data) => {
      players.value = data
    },
    (err) => console.error('Players listener error:', err)
  )

  unsubMatches = subscribeMatches(
    (data) => {
      matches.value = data
    },
    (err) => console.error('Matches listener error:', err)
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
