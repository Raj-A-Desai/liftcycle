<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useLiftStore } from '../store'
import { carryGoalsForward, dateKey, formatDate, weekFor } from '../rhythm'
import { newId } from '../id'
import { moveIntention } from '../planning'
const store = useLiftStore()
const dialog = ref<HTMLDialogElement|null>(null)
const form = reactive({id:'',title:'',date:dateKey(),time:'',duration:30,detail:'',goalId:''})
const error = ref('')
const details=ref(false)
const goals=computed(()=>!form.date?[]:carryGoalsForward(store.state.rhythm!.weeklyWins,weekFor(form.date)[0]!).filter(g=>!g.deleted&&g.text.trim()))
function open(date: string, id?: string, goalId?: string) {
  const i=store.state.rhythm?.intentions?.find(i=>i.id===id)
  Object.assign(form,{id:i?.id || '',title:i?.title || '',date:i?.date || date,time:i?.at === undefined ? '' : `${String(Math.floor(i.at)).padStart(2,'0')}:${String(Math.round((i.at%1)*60)).padStart(2,'0')}`,duration:i?.duration || 30,detail:i?.detail || '',goalId:i?.goalId || goalId || ''})
  error.value='';details.value=Boolean(id || goalId);dialog.value?.showModal()
}
function save() {
  const at = form.time ? Number(form.time.slice(0,2))+Number(form.time.slice(3))/60 : undefined
  if(!form.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !Number.isFinite(form.duration) || form.duration<5 || form.duration>720 || (at !== undefined && (!Number.isFinite(at) || at+form.duration/60>24))) {error.value='Add a title, date and 5–720 minute duration that fits in the day.';return}
  const intentions=store.state.rhythm!.intentions ||= []
  const existing=intentions.find(i=>i.id===form.id)
  const fields={title:form.title.trim(),at,duration:form.duration,detail:form.detail.trim(),goalId:form.goalId || undefined}
  if(existing){moveIntention(existing,form.date);Object.assign(existing,fields)}
  else intentions.push({id:newId(),...fields,date:form.date,done:false,moves:[]})
  dialog.value?.close()
}
function remove() {if(!confirm('Delete this intention?'))return;store.state.rhythm!.intentions=store.state.rhythm!.intentions!.filter(i=>i.id!==form.id);dialog.value?.close()}
defineExpose({open})
</script>
<template>
  <dialog ref="dialog" class="homebase-meeting-dialog intention-dialog" aria-labelledby="intention-title"><form @submit.prevent="save"><div class="rhythm-card-head"><h2 id="intention-title">{{ form.id?'Edit intention':'What do you want to make room for?' }}</h2><button type="button" class="ghost icon" aria-label="Close intention" @click="dialog?.close()">×</button></div><label>Intention<input v-model="form.title" required autofocus maxlength="160" placeholder="Reading, an errand, a focus block…" /></label>
    <details :open="details" @toggle="details=($event.target as HTMLDetailsElement).open"><summary>Optional details</summary><label>Date<input v-model="form.date" type="date" required /></label><div class="meeting-times"><label>Target start · optional<input v-model="form.time" type="time" /></label><label>Minutes<input v-model.number="form.duration" type="number" min="5" max="720" required /></label></div><label>Notes<textarea v-model="form.detail" rows="2" maxlength="1000" /></label><label v-if="goals.length || form.goalId">Weekly goal · optional<select v-model="form.goalId"><option value="">No goal linked</option><option v-if="form.goalId&&!goals.some(g=>g.id===form.goalId)" :value="form.goalId">Previously linked goal</option><option v-for="goal in goals" :key="goal.id" :value="goal.id">{{ goal.text }}</option></select></label></details>
    <p class="rhythm-footnote">{{ details?'An intention can move. Leave the start blank to keep it open.':(form.date===dateKey()?'Today':formatDate(form.date,{month:'short',day:'numeric'}))+' · flexible · no target time' }}</p><p v-if="error" class="error-note" role="alert">{{ error }}</p><div class="meeting-actions"><button v-if="form.id" type="button" class="danger" @click="remove">Delete</button><button type="submit" class="primary">{{ form.id?'Save intention':'Add' }}</button></div></form></dialog>
</template>
