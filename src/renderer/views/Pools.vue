<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const pools = ref([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const r = await fetch('https://api.isekai-pool.com/api/v1/koto/pools');
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    pools.value = Array.isArray(data) ? data : data.pools || [];
  } catch (e) {
    error.value = 'Could not load pool list. Try again later.';
    pools.value = [
      {
        name: 'koto.isekai-pool.com',
        recommended: true,
        stratum: 'stratum+tcp://koto.isekai-pool.com:3301',
        note: 'Primary pool — English support',
      },
    ];
  } finally {
    loading.value = false;
  }
});

async function usePool(url) {
  await window.kotominer.setSettings({ pool_url: url });
  router.push('/');
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <h2 class="font-mono text-lg text-white">KOTO pools</h2>
    <p v-if="loading" class="text-sm text-slate-500">Loading…</p>
    <p v-else-if="error" class="text-sm text-amber-400/90">{{ error }}</p>
    <div v-for="(p, i) in pools" :key="i" class="rounded-xl border border-slate-800 bg-kotominer-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="font-mono text-kotominer-violet">{{ p.name || p.host || 'Pool' }}</span>
        <span v-if="p.recommended" class="text-xs text-kotominer-gold">★ recommended</span>
      </div>
      <p class="mt-2 font-mono text-xs text-slate-500">{{ p.stratum || p.url }}</p>
      <button
        type="button"
        class="mt-3 rounded-lg bg-kotominer-violet/20 px-3 py-1.5 font-mono text-xs text-kotominer-violet hover:bg-kotominer-violet/30"
        @click="usePool(p.stratum || p.url)"
      >
        Use this pool
      </button>
    </div>
  </div>
</template>
