<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useLiftStore } from '../store'
import { newId } from '../id'
import { moveIntention } from '../planning'
const store = useLiftStore()
const dialog = ref<HTMLDialogElement|null>(null)
const form = reactive({id:'',title:'',date:'',time:'',duration:30,detail:''})
const error = ref('')
function open(date: string, id?: string) {
  const i=store.state.rhythm?.intentions?.find(i=>i.id===id)
  Object.assign(form,{id:i?.id || '',title:i?.title || '',date:i?.date || date,time:i?.at === undefined ? '' : `${String(Math.floor(i.at)).padStart(2,'0')}:${String(Math.round((i.at%1)*60)).padStart(2,'0')}`,duration:i?.duration || 30,detail:i?.detail || ''})
  error.value='';dialog.value?.showModal()
}
function save() {
  const at = form.time ? Number(form.time.slice(0,2))+Number(form.time.slice(3))/60 : undefined
  if(!form.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !Number.isFinite(form.duration) || form.duration<5 || form.duration>720 || (at !== undefined && (!Number.isFinite(at) || at+form.duration/60>24))) {error.value='Add a title, date and 5–720 minute duration that fits in the day.';return}
  const intentions=store.state.rhythm!.intentions ||= []
  const existing=intentions.find(i=>i.id===form.id)
  const fields={title:form.title.trim(),at,duration:form.duration,detail:form.detail.trim()}
  if(existing){moveIntention(existing,form.date);Object.assign(existing,fields)}
  else intentions.push({id:newId(),...fields,date:form.date,done:false,moves:[]})
  dialog.value?.close()
}
function remove() {if(!confirm('Delete this intention?'))return;store.state.rhythm!.intentions=store.state.rhythm!.intentions!.filter(i=>i.id!==form.id);dialog.value?.close()}
defineExpose({open})
</script>
<template>
  <dialog ref="dialog" class="homebase-meeting-dialog" aria-labelledby="intention-title"><form @submit.prevent="save"><div class="rhythm-card-head"><h2 id="intention-title">{{ form.id?'Edit intention':'Make room for something' }}</h2><button type="button" class="ghost icon" aria-label="Close intention" @click="dialog?.close()">×</button></div><label>Intention<input v-model="form.title" required maxlength="160" placeholder="Reading, an errand, a focus block…" /></label><label>Date<input v-model="form.date" type="date" required /></label><div class="meeting-times"><label>Target start · optional<input v-model="form.time" type="time" /></label><label>Minutes<input v-model.number="form.duration" type="number" min="5" max="720" required /></label></div><label>Notes<textarea v-model="form.detail" rows="2" maxlength="1000" /></label><p class="rhythm-footnote">An intention can move. Leave the start blank to keep it open.</p><p v-if="error" class="error-note" role="alert">{{ error }}</p><div class="meeting-actions"><button v-if="form.id" type="button" class="danger" @click="remove">Delete</button><button type="button" class="ghost" @click="dialog?.close()">Cancel</button><button type="submit" class="primary">Save intention</button></div></form></dialog>
</template>
