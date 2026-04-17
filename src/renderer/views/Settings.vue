<script setup>
import { ref, onMounted } from 'vue';

const api = window.kotominer;

const minimizeToTray = ref(true);
const autoStart = ref(false);
const tempWarning = ref(80);

onMounted(async () => {
  const s = await api.getSettings();
  minimizeToTray.value = s.minimize_to_tray !== false;
  autoStart.value = !!s.auto_start;
  tempWarning.value = typeof s.temp_warning === 'number' ? s.temp_warning : 80;
});

async function persist() {
  await api.setSettings({
    minimize_to_tray: minimizeToTray.value,
    auto_start: autoStart.value,
    temp_warning: Math.min(100, Math.max(50, tempWarning.value)),
  });
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6">
    <h2 class="font-mono text-lg text-white">Settings</h2>
    <p class="text-sm text-slate-400">
      Close behavior, startup, and temperature warning (shown on the Mine tab when the reading is available).
    </p>

    <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-kotominer-card p-4">
      <input v-model="minimizeToTray" type="checkbox" class="mt-1 accent-kotominer-violet" @change="persist" />
      <span>
        <span class="font-mono text-sm text-white">Minimize to tray when closing the window</span>
        <span class="mt-1 block text-xs text-slate-500">If off, closing the window quits the app. Use the tray menu to quit when this is on.</span>
      </span>
    </label>

    <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-kotominer-card p-4">
      <input v-model="autoStart" type="checkbox" class="mt-1 accent-kotominer-violet" @change="persist" />
      <span>
        <span class="font-mono text-sm text-white">Start mining when Kotominer opens</span>
        <span class="mt-1 block text-xs text-slate-500">Uses your saved wallet, pool, and thread count. Requires a working miner binary.</span>
      </span>
    </label>

    <div class="rounded-xl border border-slate-800 bg-kotominer-card p-4">
      <label class="font-mono text-xs uppercase tracking-wide text-slate-500">CPU temp warning (°C)</label>
      <input
        v-model.number="tempWarning"
        type="number"
        min="50"
        max="100"
        class="mt-2 w-full rounded-lg border border-slate-700 bg-kotominer-bg px-3 py-2 font-mono text-sm text-white focus:border-kotominer-violet focus:outline-none"
        @change="persist"
      />
    </div>
  </div>
</template>
