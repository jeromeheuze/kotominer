<script setup>
import { computed } from 'vue';

const props = defineProps({
  samples: {
    type: Array,
    default: () => [],
  },
});

const viewW = 400;
const viewH = 48;

const pathD = computed(() => {
  const s = props.samples.filter((x) => typeof x === 'number' && !Number.isNaN(x));
  if (s.length < 2) return '';
  const min = Math.min(...s);
  const max = Math.max(...s, min * 1.0001);
  const range = max - min || 1;
  return s
    .map((v, i) => {
      const x = (i / (s.length - 1)) * viewW;
      const y = viewH - 2 - ((v - min) / range) * (viewH - 4);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
});
</script>

<template>
  <svg
    :viewBox="`0 0 ${viewW} ${viewH}`"
    class="h-12 w-full text-kotominer-gold"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path v-if="pathD" fill="none" stroke="currentColor" stroke-width="1.5" :d="pathD" opacity="0.85" />
    <text
      v-else
      x="8"
      y="28"
      class="fill-slate-600"
      font-family="ui-monospace, monospace"
      font-size="11"
    >
      Mining to see history…
    </text>
  </svg>
</template>
