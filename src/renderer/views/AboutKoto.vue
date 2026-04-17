<script setup>
function open(url) {
  window.kotominer.openExternal(url);
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <h2 class="font-mono text-lg text-kotominer-gold">What is KOTO?</h2>
    <p class="text-sm leading-relaxed text-slate-400">
      KOTO is a Japanese CPU-oriented cryptocurrency (yescryptR8G), Zcash lineage, with a focus on accessible mining and
      privacy options.
    </p>
    <h3 class="font-mono text-base text-white">Why CPU mining?</h3>
    <p class="text-sm leading-relaxed text-slate-400">
      The network is designed to stay friendly to consumer hardware — your machine can participate without industrial ASIC
      farms dominating rewards.
    </p>
    <h3 class="font-mono text-base text-white">Learn more</h3>
    <ul class="list-inside list-disc text-sm text-slate-400">
      <li>
        <button type="button" class="text-kotominer-violet hover:underline" @click="open('https://explorer.isekai-pool.com')">
          Explorer
        </button>
      </li>
      <li>
        <button type="button" class="text-kotominer-violet hover:underline" @click="open('https://isekai-pool.com/koto.html')">
          Mining on Isekai Pool
        </button>
      </li>
    </ul>
  </div>
</template>
