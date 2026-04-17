<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import HashrateSparkline from '../components/HashrateSparkline.vue';

defineOptions({ name: 'Mining' });

const api = window.kotominer;

const wallet = ref('');
const poolUrl = ref('stratum+tcp://koto.isekai-pool.com:3301');
const threads = ref(4);
const recommended = ref(4);
/** Logical CPU count from os.cpus().length — max useful mining threads on this machine */
const maxLogicalCpus = ref(64);
const cpuModel = ref('');
const mining = ref(false);
const hashrate = ref(0);
const shares = ref({ accepted: 0, rejected: 0 });
const threadHashrates = ref([]);
const logs = ref([]);
const minerError = ref('');
const paths = ref({
  platformDir: '',
  resourcesDir: '',
  resolved: null,
  present: false,
  selectedBasename: null,
  cachedBasename: null,
  windowsCandidates: [],
});
const restoreMsg = ref('');

const networkStatus = ref(null);
const newsItems = ref([]);
const cpuTemp = ref(null);
const tempWarning = ref(80);
const hashHistory = ref([]);
let lastHashSampleAt = 0;
const killAllBusy = ref(false);

let unsubStats;
let unsubLog;
let unsubErr;
let unsubClose;
let unsubStarted;
let unsubStopped;
let statusInterval;
let tempInterval;

function fmtHash(h) {
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${Math.round(h)} H/s`;
}

const canStart = computed(() => {
  return (
    !mining.value &&
    paths.value.present &&
    wallet.value.trim().length >= 20 &&
    poolUrl.value.trim().length > 8 &&
    threads.value >= 1
  );
});

const tempHot = computed(() => {
  if (cpuTemp.value == null) return false;
  return cpuTemp.value >= tempWarning.value;
});

async function fetchKotoStatus() {
  try {
    const r = await fetch('https://api.isekai-pool.com/api/v1/koto/status');
    if (!r.ok) return;
    networkStatus.value = await r.json();
  } catch {
    /* ignore */
  }
}

async function applyMinerStatusFromMain() {
  try {
    const st = await api.getMinerStatus();
    mining.value = !!st.running;
    if (st.stats) {
      hashrate.value = st.stats.hashrate || 0;
      shares.value = { ...st.stats.shares };
      threadHashrates.value = Array.isArray(st.stats.threads) ? st.stats.threads.map((t) => ({ ...t })) : [];
    }
  } catch {
    /* ignore */
  }
}

async function fetchNews() {
  try {
    const r = await fetch('https://api.isekai-pool.com/api/v1/news');
    if (!r.ok) {
      newsItems.value = [];
      return;
    }
    const data = await r.json();
    const list = Array.isArray(data) ? data : data.items || data.news || [];
    newsItems.value = Array.isArray(list) ? list.slice(0, 3) : [];
  } catch {
    newsItems.value = [];
  }
}

onMounted(async () => {
  const s = await api.getSettings();
  wallet.value = s.wallet_address || '';
  poolUrl.value = s.pool_url || poolUrl.value;
  threads.value = s.threads ?? 4;

  const cpu = await api.getCpuInfo();
  recommended.value = cpu.recommended_threads;
  maxLogicalCpus.value = Math.max(1, cpu.cores || 1);
  cpuModel.value = cpu.model || '';
  if (!s.threads) {
    threads.value = cpu.recommended_threads;
  }
  threads.value = Math.min(Math.max(1, threads.value), maxLogicalCpus.value);
  tempWarning.value = typeof s.temp_warning === 'number' ? s.temp_warning : 80;

  paths.value = await api.getMinerPaths();
  await applyMinerStatusFromMain();

  await fetchKotoStatus();
  await fetchNews();
  statusInterval = setInterval(fetchKotoStatus, 60_000);
  tempInterval = setInterval(async () => {
    cpuTemp.value = await api.getCpuTemp();
  }, 10_000);
  cpuTemp.value = await api.getCpuTemp();

  unsubStats = api.onMinerStats((s) => {
    hashrate.value = s.hashrate || 0;
    shares.value = { ...s.shares };
    threadHashrates.value = Array.isArray(s.threads) ? s.threads.map((t) => ({ ...t })) : [];
    const now = Date.now();
    if (mining.value && now - lastHashSampleAt > 2500) {
      lastHashSampleAt = now;
      const h = s.hashrate || 0;
      if (h > 0) {
        hashHistory.value = [...hashHistory.value, h].slice(-72);
      }
    }
  });
  unsubLog = api.onMinerLog((line) => {
    logs.value = [line, ...logs.value].slice(0, 40);
  });
  unsubErr = api.onMinerError((msg) => {
    minerError.value = msg;
    mining.value = false;
  });
  unsubClose = api.onMinerClose(() => {
    mining.value = false;
    hashHistory.value = [];
  });
  unsubStarted = api.onMinerStarted(() => {
    mining.value = true;
  });
  unsubStopped = api.onMinerStopped(() => {
    mining.value = false;
    hashHistory.value = [];
  });
});

onUnmounted(() => {
  unsubStats?.();
  unsubLog?.();
  unsubErr?.();
  unsubClose?.();
  unsubStarted?.();
  unsubStopped?.();
  clearInterval(statusInterval);
  clearInterval(tempInterval);
});

async function persist() {
  const t = Math.min(Math.max(1, threads.value), maxLogicalCpus.value);
  threads.value = t;
  await api.setSettings({
    wallet_address: wallet.value.trim(),
    pool_url: poolUrl.value.trim(),
    threads: t,
  });
}

async function startMining() {
  minerError.value = '';
  await persist();
  paths.value = await api.getMinerPaths();
  const res = await api.minerStart({
    pool_url: poolUrl.value.trim(),
    wallet_address: wallet.value.trim(),
    threads: threads.value,
    solo: false,
  });
  if (!res.ok) {
    minerError.value = res.error || 'Failed to start';
    return;
  }
  mining.value = true;
}

async function stopMining() {
  await api.minerStop();
  mining.value = false;
  hashHistory.value = [];
  lastHashSampleAt = 0;
}

async function refreshPaths() {
  paths.value = await api.getMinerPaths();
}

async function restoreMiner() {
  restoreMsg.value = 'Checking…';
  const r = await api.restoreMiner();
  restoreMsg.value = r.ok ? `Restored to ${r.path}` : r.error || 'Restore failed';
  await refreshPaths();
}

async function killAllMiners() {
  killAllBusy.value = true;
  minerError.value = '';
  try {
    const r = await api.minerKillAll();
    if (!r.ok) {
      minerError.value = r.error || 'Could not kill miner processes';
      return;
    }
    mining.value = false;
    hashHistory.value = [];
    hashrate.value = 0;
    shares.value = { accepted: 0, rejected: 0 };
    threadHashrates.value = [];
  } finally {
    killAllBusy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div
      v-if="!paths.present"
      class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200/90"
    >
      <p class="font-medium text-amber-100">No working miner found</p>
      <p class="mt-1 text-xs text-amber-200/70">
        On <strong>Windows</strong>, unpack the full KotoDevelopers zip into
        <code class="font-mono text-amber-100">resources/{{ paths.platformDir }}/</code>
        (all <code class="font-mono">minerd-*.exe</code> + DLLs). Kotominer picks the best build your CPU can run (see
        <code class="font-mono">resources/README.md</code>). Optional: place a single
        <code class="font-mono">cpuminer-koto.exe</code> under your profile <code class="font-mono">bin</code> folder to override.
      </p>
      <button
        type="button"
        class="mt-3 rounded-lg bg-amber-500/20 px-3 py-1.5 font-mono text-xs text-amber-100 hover:bg-amber-500/30"
        @click="restoreMiner"
      >
        Restore miner (GitHub manifest)
      </button>
      <button
        type="button"
        class="ml-2 rounded-lg border border-slate-600 px-3 py-1.5 font-mono text-xs text-slate-300 hover:bg-slate-800"
        @click="refreshPaths"
      >
        Refresh paths
      </button>
      <p v-if="restoreMsg" class="mt-2 font-mono text-xs text-slate-400">{{ restoreMsg }}</p>
    </div>

    <p v-else class="rounded-lg border border-slate-800/80 bg-kotominer-elevated/40 px-3 py-2 text-xs text-slate-500">
      Using
      <span class="font-mono text-kotominer-gold">{{ paths.selectedBasename || '—' }}</span>
      <span class="text-slate-600"> — </span>
      fastest build your CPU can run (auto-detected).
    </p>

    <section class="rounded-xl border border-slate-800 bg-kotominer-card p-6">
      <label class="block font-mono text-xs uppercase tracking-wide text-slate-500">KOTO wallet</label>
      <input
        v-model="wallet"
        type="text"
        autocomplete="off"
        placeholder="k1…"
        :disabled="mining"
        class="mt-1 w-full rounded-lg border border-slate-700 bg-kotominer-bg px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-kotominer-violet focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        @change="persist"
      />

      <label class="mt-4 block font-mono text-xs uppercase tracking-wide text-slate-500">Pool (stratum)</label>
      <input
        v-model="poolUrl"
        type="text"
        :disabled="mining"
        class="mt-1 w-full rounded-lg border border-slate-700 bg-kotominer-bg px-3 py-2 font-mono text-sm text-white focus:border-kotominer-violet focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        @change="persist"
      />

      <label class="mt-4 block font-mono text-xs uppercase tracking-wide text-slate-500">
        CPU threads
      </label>
      <p v-if="cpuModel" class="mt-1 font-mono text-[11px] leading-snug text-slate-500">
        {{ cpuModel }}
      </p>
      <p class="mt-1 font-mono text-[11px] text-slate-500">
        Maximum (logical CPUs): <span class="text-kotominer-gold">{{ maxLogicalCpus }}</span>
        · recommended: <span class="text-slate-400">{{ recommended }}</span>
      </p>
      <input
        v-model.number="threads"
        type="range"
        min="1"
        :max="maxLogicalCpus"
        :disabled="mining"
        class="mt-2 w-full accent-kotominer-violet disabled:cursor-not-allowed disabled:opacity-50"
        @change="persist"
      />
      <div class="font-mono text-sm text-kotominer-gold">{{ threads }} / {{ maxLogicalCpus }} threads</div>
    </section>

    <div class="flex flex-wrap items-center gap-3">
      <button
        v-if="!mining"
        type="button"
        class="rounded-xl bg-kotominer-violet px-8 py-3 font-mono text-sm font-semibold text-white shadow-lg shadow-kotominer-violet/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canStart"
        @click="startMining"
      >
        ▶ Start mining
      </button>
      <button
        v-else
        type="button"
        class="rounded-xl border border-red-500/50 bg-red-500/10 px-8 py-3 font-mono text-sm font-semibold text-red-300 hover:bg-red-500/20"
        @click="stopMining"
      >
        Stop
      </button>
      <span class="font-mono text-kotominer-gold">{{ fmtHash(hashrate) }}</span>
      <span class="font-mono text-sm text-slate-500">
        shares {{ shares.accepted }} / {{ shares.rejected }}
      </span>
      <span v-if="cpuTemp != null" class="font-mono text-sm" :class="tempHot ? 'text-amber-400' : 'text-slate-500'">
        CPU {{ cpuTemp }}°C
      </span>
    </div>

    <p v-if="paths.present" class="font-mono text-[11px] leading-relaxed text-slate-500">
      If mining gets stuck or you see “miner already running” after a crash, force-stop the app’s miner and end stray
      <code class="text-slate-400">minerd</code> processes.
      <button
        type="button"
        class="ml-1 text-amber-400/90 underline decoration-amber-400/40 hover:text-amber-300"
        :disabled="killAllBusy"
        @click="killAllMiners"
      >
        {{ killAllBusy ? 'Stopping…' : 'Force stop & kill all' }}
      </button>
    </p>

    <p
      v-if="tempHot"
      class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-200/90"
    >
      CPU temperature is at or above your warning ({{ tempWarning }}°C). Consider fewer threads or better cooling.
    </p>

    <section
      v-if="networkStatus"
      class="rounded-xl border border-slate-800 bg-kotominer-bg/50 p-4 font-mono text-[11px] text-slate-400"
    >
      <h2 class="text-xs uppercase tracking-wide text-slate-500">KOTO network</h2>
      <p class="mt-2">
        Difficulty {{ Number(networkStatus.difficulty).toFixed(2) }} · Blocks {{ networkStatus.blocks }} · Peers
        {{ networkStatus.peers }} ·
        <span :class="networkStatus.synced ? 'text-emerald-500/90' : 'text-amber-400'">
          {{ networkStatus.synced ? 'Synced' : 'Syncing' }}
        </span>
      </p>
      <a
        v-if="networkStatus.explorer"
        class="mt-2 inline-block text-kotominer-violet hover:underline"
        href="#"
        @click.prevent="api.openExternal(networkStatus.explorer)"
      >
        Block explorer
      </a>
    </section>

    <section v-if="mining" class="rounded-xl border border-slate-800 bg-kotominer-bg/50 p-4">
      <h2 class="font-mono text-xs uppercase tracking-wide text-slate-500">Hashrate (recent)</h2>
      <HashrateSparkline class="mt-2" :samples="hashHistory" />
    </section>

    <section v-if="newsItems.length > 0" class="rounded-xl border border-slate-800 bg-kotominer-bg/50 p-4">
      <h2 class="font-mono text-xs uppercase tracking-wide text-slate-500">News</h2>
      <ul class="mt-2 space-y-2">
        <li v-for="(item, i) in newsItems" :key="i" class="text-sm">
          <button
            v-if="item.url"
            type="button"
            class="text-left text-kotominer-violet hover:underline"
            @click="api.openExternal(item.url)"
          >
            {{ item.title || item.headline || 'Announcement' }}
          </button>
          <span v-else class="text-slate-300">{{ item.title || item.body }}</span>
          <p v-if="item.body && item.title" class="mt-0.5 text-xs text-slate-500">{{ item.body }}</p>
        </li>
      </ul>
    </section>

    <section
      v-if="mining && threadHashrates.length > 0"
      class="rounded-xl border border-slate-800 bg-kotominer-bg/50 p-4"
    >
      <h2 class="font-mono text-xs uppercase tracking-wide text-slate-500">Per-thread hashrate</h2>
      <ul class="mt-2 grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto font-mono text-[11px] text-slate-400 sm:grid-cols-3 md:grid-cols-4">
        <li v-for="row in threadHashrates" :key="row.id" class="flex justify-between gap-2 border-b border-slate-800/60 py-0.5">
          <span class="text-slate-500">thread {{ row.id }}</span>
          <span class="shrink-0 text-kotominer-gold">{{ fmtHash(row.hashrate) }}</span>
        </li>
      </ul>
    </section>

    <p v-if="minerError" class="rounded-lg border border-red-500/30 bg-red-500/10 p-3 font-mono text-xs text-red-300 whitespace-pre-wrap">
      {{ minerError }}
    </p>

    <section class="rounded-xl border border-slate-800 bg-kotominer-bg/50 p-4">
      <h2 class="font-mono text-xs uppercase tracking-wide text-slate-500">Miner log</h2>
      <pre class="mt-2 max-h-48 overflow-auto font-mono text-[11px] leading-relaxed text-slate-400">{{ logs.join('\n') || '—' }}</pre>
    </section>
  </div>
</template>
