<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiftStore } from '../store'
import { acceptTrainingMove, moveIntention, planningSuggestions, undoIntentionMove, undoTrainingMove } from '../planning'
import type { PlanningSuggestion } from '../planning'
import { formatDate, shiftDay } from '../rhythm'
import { newId } from '../id'
const props = defineProps<{ today: string }>()
const store = useLiftStore()
const suggestions = computed(()=>planningSuggestions(store.state,props.today))
const recentMoves = computed(()=>(store.state.trainingMoves || []).filter(m=>m.date >= shiftDay(props.today,-7)).slice(-3).reverse())
const movedIntentions = computed(()=>(store.state.rhythm?.intentions || []).filter(i=>!i.done && i.moves.length && i.date>=props.today).slice(-2))
const error = ref('')
function apply(s: PlanningSuggestion) {
  error.value=''
  try {
    if(s.kind==='training' && s.from && s.to) acceptTrainingMove(store.state,s.from,s.to,newId())
    else if(s.intentionId && s.to) { const i=store.state.rhythm?.intentions?.find(i=>i.id===s.intentionId);if(i)moveIntention(i,s.to) }
  } catch(e:any) {error.value=e.message}
}
function undo(id: string) {error.value='';try {undoTrainingMove(store.state,id)}catch(e:any){error.value=e.message}}
</script>
<template>
  <section class="quiet-section adjustments"><div class="eyebrow">ADJUST</div><h2>A little room to adapt</h2>
    <p v-if="!suggestions.length && !recentMoves.length && !movedIntentions.length" class="muted">No changes suggested right now.</p>
    <article v-for="s in suggestions" :key="s.id" class="adjustment-row"><strong>{{ s.title }}</strong><p>{{ s.detail }}</p><div class="inline-actions"><button v-if="s.to" class="text-btn" @click="apply(s)">Move to {{ formatDate(s.to,{weekday:'short',month:'short',day:'numeric'}) }}</button><button class="text-btn muted" @click="(store.state.dismissedSuggestions ||= []).push(s.id)">Leave for now</button></div></article>
    <div v-for="move in recentMoves" :key="move.id" class="undo-row"><span>Training moved {{ formatDate(move.fromDate,{month:'short',day:'numeric'}) }} → {{ formatDate(move.date,{month:'short',day:'numeric'}) }}</span><button class="text-btn" @click="undo(move.id)">Undo move</button></div>
    <div v-for="i in movedIntentions" :key="i.id" class="undo-row"><span>{{ i.title }} → {{ formatDate(i.date,{month:'short',day:'numeric'}) }}</span><button class="text-btn" @click="undoIntentionMove(i)">Undo move</button></div>
    <p v-if="error" class="error-note" role="alert">{{ error }}</p>
  </section>
</template>
