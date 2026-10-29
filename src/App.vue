<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
    <!-- Top quick route switcher -->
    <header class="bg-slate-950/80 backdrop-blur border-b border-slate-800/80 sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between text-xs">
      <div class="flex items-center gap-2">
        <span class="text-lg">🏓</span>
        <span class="font-bold tracking-tight text-white hidden sm:inline">Pickleball Queue</span>
      </div>

      <nav class="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-inner">
        <router-link
          to="/admin"
          class="px-3 py-1.5 rounded-md font-medium transition-all"
          :class="$route.path.startsWith('/admin') ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
        >
          📱 iPad Admin
        </router-link>
        <router-link
          to="/view"
          class="px-3 py-1.5 rounded-md font-medium transition-all"
          :class="$route.path.startsWith('/view') ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
        >
          📲 Mobile Live View
        </router-link>
      </nav>
    </header>

    <main class="flex-1 flex flex-col">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>
