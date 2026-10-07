<script setup lang="ts">
defineProps<{ running: boolean }>()
// Fixed positions keep the atmosphere stable through navigation and hydration.
const motes = Array.from({ length: 12 }, (_, i) => ({
  left: `${(i * 31 + 7) % 100}%`,
  top: `${(i * 23 + 11) % 100}%`,
  '--drift-duration': `${32 + i * 3}s`,
  '--drift-delay': `${-i * 7}s`,
  '--mote-size': `${i % 3 === 0 ? 3 : 2}px`,
}))
</script>

<template>
  <div class="ambient-atmosphere" :class="{ 'is-paused': !running }" aria-hidden="true">
    <div class="ambient-wash ambient-wash-purple"></div>
    <div class="ambient-wash ambient-wash-apricot"></div>
    <i v-for="(mote, index) in motes" :key="index" class="ambient-mote" :style="mote"></i>
  </div>
</template>
