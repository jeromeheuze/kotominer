<script setup>
function open(url) {
  window.kotominer.openExternal(url);
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-4">
    <h2 class="font-mono text-lg text-white">Games &amp; rewards</h2>
    <div class="rounded-xl border border-slate-800 bg-kotominer-card p-5">
      <h3 class="font-mono text-kotominer-gold">Isekai Adventure</h3>
      <p class="mt-2 text-sm text-slate-400">Coming soon — earn KOTO while you play.</p>
    </div>
    <div class="rounded-xl border border-slate-800 bg-kotominer-card p-5">
      <h3 class="font-mono text-kotominer-violet">GameGlass.Live</h3>
      <p class="mt-2 text-sm text-slate-400">Crypto payments for game engines.</p>
      <button
        type="button"
        class="mt-3 text-sm text-kotominer-violet hover:underline"
        @click="open('https://gameglass.live/')"
      >
        Learn more →
      </button>
    </div>
  </div>
</template>
