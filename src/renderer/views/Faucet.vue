<script setup>
const api = window.kotominer;

function openBrowser() {
  api.openExternal('https://api.isekai-pool.com/earn');
}
</script>

<template>
  <div class="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-mono text-lg text-white">Earn hub</h2>
      <button
        type="button"
        class="rounded-lg border border-slate-600 px-3 py-1.5 font-mono text-xs text-slate-300 hover:bg-slate-800"
        @click="openBrowser"
      >
        Open in browser
      </button>
    </div>
    <p class="text-xs text-slate-500">
      Embedded view of api.isekai-pool.com/earn. If the page stays blank, use “Open in browser” (some networks block embedding).
    </p>
    <webview
      class="min-h-0 flex-1 rounded-xl border border-slate-800 bg-kotominer-bg"
      src="https://api.isekai-pool.com/earn"
      allowpopups
    />
  </div>
</template>
