<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <span class="homebase-identity" :class="{ 'mark-only': compact }">
    <img class="homebase-mark" src="/brand/mark.svg" alt="" width="40" height="40" />
    <span v-if="!compact" class="homebase-wordmark">homebase</span>
  </span>
</template>
