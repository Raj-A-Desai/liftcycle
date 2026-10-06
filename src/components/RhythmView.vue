<script setup lang="ts">
import { newId } from '../id'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useLiftStore } from '../store'
import { carryGoalsForward, dateKey, entriesFor, formatDate, formatHour, hourNow, isDone, loadFor, mergeRhythm, shiftDay, weekFor, workoutEntries } from '../rhythm'
import type { Goal, Meeting, TimelineEntry } from '../rhythm'
const props = defineProps<{ selectedDate: string }>()
const emit = defineEmits<{ 'update:selectedDate': [value: string]; workout: [date: string, id?: string]; training: [] }>()
const store = useLiftStore()
const rhythm = computed(() => store.state.rhythm!)
const selected = computed({get:()=>props.selectedDate,set:v=>emit('update:selectedDate',v)})
const now = ref(new Date())
const today = computed(()=>dateKey(now.value))
const week = computed(()=>weekFor(selected.value))
const weekKey = computed(()=>week.value[0]!)
const currentWeek = computed(()=>weekFor(today.value)[0]!)
watch([currentWeek, weekKey, () => rhythm.value.weeklyWins, () => store.syncStatus], () => {
  if (weekKey.value !== currentWeek.value || store.syncStatus === 'conflict') return
  const next = carryGoalsForward(rhythm.value.weeklyWins, currentWeek.value)
  if (JSON.stringify(next) !== JSON.stringify(rhythm.value.weeklyWins[currentWeek.value] || [])) rhythm.value.weeklyWins[currentWeek.value] = next
}, { deep: true, immediate: true })
const weekLabel = computed(()=>`${formatDate(week.value[0]!,{month:'short',day:'numeric'})} – ${formatDate(week.value[6]!,{month:'short',day:'numeric',year:'numeric'})}`)
const workouts = (key: string) => workoutEntries(key,store.scheduledSplitForDate(key),store.state.history,store.state.draft)
const entries = computed(()=>entriesFor(rhythm.value,selected.value,workouts(selected.value)))
const dayTasks = (key: string) => [...new Map(entriesFor(rhythm.value,key,workouts(key)).filter(e=>e.kind === 'task' || (e.kind === 'workout' && e.status !== 'skipped')).map(e=>[e.id,e])).values()]
const completion = (key: string) => {const tasks=dayTasks(key);return {done:tasks.filter(t=>isDone(rhythm.value,key,t)).length,total:tasks.length}}
const dayProgress = computed(()=>completion(selected.value))
const load = computed({get:()=>loadFor(rhythm.value,selected.value),set:value=>{rhythm.value.load[selected.value]=value}})
const daily = computed(()=>rhythm.value.daily[selected.value] || {})
const basics = [{key:'creatine',label:'Creatine',detail:'Daily'},{key:'skincare',label:'Skincare',detail:'AM / PM'},{key:'sleep75',label:'7.5 hours',detail:'In bed'}]
const basicsCount = computed(()=>basics.filter(b=>daily.value[b.key]).length+Number(daily.value.water || 0))
const goals = computed<Goal[]>(()=>{
  const saved = rhythm.value.weeklyWins[weekKey.value] || []
  return [...saved,...Array.from({length:Math.max(0,5-saved.length)},()=>({text:'',done:false}))]
})
const meaningfulGoals = computed(()=>goals.value.filter(g=>g.text.trim()))
const goalsDone = computed(()=>meaningfulGoals.value.filter(g=>g.done).length)
function setGoal(index: number, field: 'text'|'done', value: string|boolean) {
  const rows = rhythm.value.weeklyWins[weekKey.value] ||= []
  while(rows.length<=index)rows.push({text:'',done:false})
  if(field==='text')rows[index]!.text=String(value)
  else rows[index]!.done=Boolean(value)
}
function setDaily(key: string,value: boolean|number) {(rhythm.value.daily[selected.value] ||= {})[key]=value}
function toggleTask(e: TimelineEntry) {setDaily(['walk','read'].includes(e.id)?e.id:`task-${e.id}`,!isDone(rhythm.value,selected.value,e))}
function streak(habit: string) {let key=today.value,count=0;if(!rhythm.value.daily[key]?.[habit])key=shiftDay(key,-1);while(count<365&&rhythm.value.daily[key]?.[habit]){count++;key=shiftDay(key,-1)}return count}
const weeklyLifts = computed(()=>store.state.history.filter(w=>week.value.includes(w.date)&&w.status!=='skipped').length)
const weeklyBuilds = computed(()=>week.value.filter(key=>rhythm.value.daily[key]?.['task-vedflow']||rhythm.value.daily[key]?.['task-vedflow-admin']).length)
const momentum = computed(()=>{
  let done=0,total=0
  for(const key of week.value)for(const e of dayTasks(key))if(key<today.value || (key===today.value && (e.endAt<=hourNow(now.value)||isDone(rhythm.value,key,e)))){total++;if(isDone(rhythm.value,key,e))done++}
  return total ? Math.round(done/total*100) : null
})
const timeline = ref<HTMLElement|null>(null)
const elapsed = ref(0)
const railHeight = ref(0)
function updateRail() {
  const rows=[...(timeline.value?.querySelectorAll<HTMLElement>('[data-timed]') || [])]
  if(!rows.length){railHeight.value=0;return}
  const bounds=timeline.value!.getBoundingClientRect();let y=0
  for(const row of rows){const top=row.getBoundingClientRect().top-bounds.top;const start=Number(row.dataset.start),end=Number(row.dataset.end);if(hourNow(now.value)<start)break;y=top+row.offsetHeight*Math.min(1,Math.max(0,(hourNow(now.value)-start)/(end-start)));if(hourNow(now.value)<end)break}
  railHeight.value=timeline.value!.offsetHeight;elapsed.value=Math.min(railHeight.value,y)
}
const isCurrent = (e: TimelineEntry)=>selected.value===today.value&&!e.allDay&&hourNow(now.value)>=e.at&&hourNow(now.value)<e.endAt
const dialog = ref<HTMLDialogElement|null>(null)
const meeting = reactive({id:'',title:'',date:'',start:'09:00',end:'10:00'})
const meetingError = ref('')
const timeInput=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`
function openMeeting(id?:string) {
  const existing=rhythm.value.meetings.find(m=>m.id===id)
  Object.assign(meeting,existing ? {...existing,start:timeInput(existing.start),end:timeInput(existing.end)} : {id:'',title:'',date:selected.value,start:'09:00',end:'10:00'})
  meetingError.value='';dialog.value?.showModal()
}
function saveMeeting() {
  const minutes=(s:string)=>{const [h,m]=s.split(':').map(Number);return h!*60+m!}
  const value:Meeting={id:meeting.id||newId(),title:meeting.title.trim(),date:meeting.date,start:minutes(meeting.start),end:minutes(meeting.end)}
  if(!value.title||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(value.start)||!Number.isFinite(value.end)||value.end<=value.start){meetingError.value='Add a name and an end time after the start.';return}
  const index=rhythm.value.meetings.findIndex(m=>m.id===value.id)
  if(index>=0)rhythm.value.meetings[index]=value;else rhythm.value.meetings.push(value)
  selected.value=value.date;dialog.value?.close()
}
function deleteMeeting(){if(!confirm('Delete this meeting?'))return;rhythm.value.meetings=rhythm.value.meetings.filter(m=>m.id!==meeting.id);dialog.value?.close()}
function resetDay(){if(!confirm('Reset this day’s routine checkmarks and body check? Workouts and meetings stay saved.'))return;delete rhythm.value.daily[selected.value];delete rhythm.value.load[selected.value]}
const transferMessage=ref('')
const transferError=ref(false)
const transferring=ref(false)
const transferFile=ref<HTMLInputElement|null>(null)
let popup:Window|null=null,nonce='',transferTimer:number|undefined,timer:number|undefined,observer:ResizeObserver|undefined
const LEGACY_ORIGIN='https://raj-weekly-rhythm.radesai.chatgpt.site'
function startTransfer(){
  if(!store.userId){transferError.value=true;transferMessage.value='Sign in to Homebase above before bringing in Rhythm.';return}
  nonce=newId();transferring.value=true;transferError.value=false
  transferMessage.value='Open Rhythm and sign in if asked. Keep this tab open.'
  popup=window.open(`${LEGACY_ORIGIN}/#homebase-transfer`,'homebase-rhythm-transfer')
  if(!popup){transferring.value=false;transferMessage.value='Allow the Rhythm window, or export a transfer file from Rhythm and import it here.';return}
  window.clearInterval(transferTimer)
  const started=Date.now()
  transferTimer=window.setInterval(()=>{
    if(popup?.closed||Date.now()-started>180000){window.clearInterval(transferTimer);transferring.value=false;transferMessage.value='You can retry, or use a Rhythm transfer file.';return}
    popup?.postMessage({type:'homebase:request-rhythm',nonce},LEGACY_ORIGIN)
  },1200)
}
async function acceptTransfer(payload:any){
  if(!store.userId)throw new Error('Sign in to Homebase before importing Rhythm.')
  if(store.syncStatus==='conflict')throw new Error('Resolve the sync conflict above before importing.')
  const snapshot=JSON.parse(JSON.stringify(rhythm.value))
  const merged=mergeRhythm(snapshot,payload)
  localStorage.setItem('homebase-rhythm-before-import',JSON.stringify(snapshot))
  store.state.rhythm=merged
  await store.pushCloud()
  transferMessage.value=store.syncStatus==='synced'?'Rhythm is now part of Homebase. Your goals, checkmarks, and meetings are here.':'Rhythm imported on this device. Check the sync status above before switching devices.'
  transferError.value=false
}
async function onMessage(e:MessageEvent){
  if(e.origin!==LEGACY_ORIGIN||e.source!==popup||e.data?.nonce!==nonce||e.data?.type!=='rhythm:transfer')return
  window.clearInterval(transferTimer);transferring.value=false
  try{await acceptTransfer(e.data.payload);popup?.postMessage({type:'homebase:rhythm-received',nonce},LEGACY_ORIGIN)}catch(error:any){transferError.value=true;transferMessage.value=error.message}
}
async function importTransfer(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>5_000_000)throw new Error('Choose a Rhythm transfer file smaller than 5 MB.');await acceptTransfer(JSON.parse(await file.text()))}catch(error:any){transferError.value=true;transferMessage.value=error.message}input.value=''}
watch([entries,selected],()=>nextTick(updateRail),{deep:true})
onMounted(()=>{timer=window.setInterval(()=>{now.value=new Date();updateRail()},30000);window.addEventListener('message',onMessage);observer=new ResizeObserver(updateRail);if(timeline.value)observer.observe(timeline.value);nextTick(updateRail)})
onBeforeUnmount(()=>{window.clearInterval(timer);window.clearInterval(transferTimer);observer?.disconnect();window.removeEventListener('message',onMessage)})
</script>

<template>
  <section class="rhythm-page">
    <div class="module-heading"><div><div class="eyebrow">RHYTHM</div><h1>Your day, in focus.</h1></div><div class="rhythm-week-controls"><button class="ghost icon" aria-label="Previous week" @click="selected=shiftDay(selected,-7)">‹</button><button class="ghost range-label" @click="selected=today">{{ weekLabel }}</button><button class="ghost icon" aria-label="Next week" @click="selected=shiftDay(selected,7)">›</button></div></div>
    <div v-if="!rhythm.importedAt" class="rhythm-import"><div><strong>Bring your Rhythm with you</strong><p>Move your saved goals, checkmarks, and meetings into Homebase.</p></div><div class="transfer-actions"><button class="primary" :disabled="transferring" @click="startTransfer">{{ transferring ? 'Waiting for Rhythm…' : 'Bring in Rhythm' }}</button><button class="text-btn" @click="transferFile?.click()">Import transfer file</button></div></div>
    <input ref="transferFile" hidden type="file" accept="application/json" @change="importTransfer" />
    <p v-if="transferMessage" class="transfer-message" :class="{'error-note':transferError}" role="status">{{ transferMessage }}</p>
    <div class="rhythm-week" aria-label="Choose a day">
      <button v-for="key in week" :key="key" class="rhythm-day" :class="{selected:selected===key,today:today===key}" :aria-pressed="selected===key" :aria-current="today===key?'date':undefined" @click="selected=key">
        <span class="rhythm-day-top">{{ formatDate(key,{weekday:'short'}) }}<span v-if="today===key" class="today-mark">Today</span></span><strong class="rhythm-day-number">{{ formatDate(key,{day:'2-digit'}) }}</strong>
        <span class="rhythm-day-focus" :class="{'has-workout':workouts(key).length}">{{ workouts(key)[0]?.workout?.name || store.scheduledSplitForDate(key)?.name || (loadFor(rhythm,key)==='off'?'Open day':'Day plan') }}<small v-if="workouts(key)[0]?.status==='skipped'"> · skipped</small><small v-else-if="workouts(key)[0]?.status==='completed'"> ✓</small></span>
        <span class="rhythm-mini-track"><i :style="{width:(completion(key).total?completion(key).done/completion(key).total*100:0)+'%'}"></i></span>
      </button>
    </div>
    <div class="rhythm-layout">
      <section class="day-panel">
        <div class="day-panel-head"><div><p class="eyebrow">{{ formatDate(selected,{month:'long',day:'numeric',year:'numeric'}) }}</p><h2>{{ formatDate(selected,{weekday:'long'}) }}</h2></div><div class="head-actions"><button class="ghost small" @click="selected=today">Today</button><button class="ghost icon" aria-label="Previous day" @click="selected=shiftDay(selected,-1)">‹</button><button class="ghost icon" aria-label="Next day" @click="selected=shiftDay(selected,1)">›</button></div></div>
        <div class="rhythm-toolbar"><label class="day-load">{{ rhythm.labels.work }} day<select v-model="load" aria-label="Workday intensity"><option value="red">Busy</option><option value="yellow">Normal</option><option value="green">Light</option><option value="off">Off</option></select></label><span class="time-zone-note">ET · routine times are targets</span><button class="ghost small add-meeting" @click="openMeeting()">+ Add meeting</button></div>
        <div ref="timeline" class="rhythm-timeline">
          <article v-for="(entry,i) in entries" :key="entry.id+'-'+entry.at" class="rhythm-entry" :class="[entry.kind,{done:isDone(rhythm,selected,entry),current:isCurrent(entry),skipped:entry.status==='skipped'}]" :data-timed="!entry.allDay?'':undefined" :data-start="entry.at" :data-end="entry.endAt">
            <div class="entry-time"><strong>{{ entry.allDay ? 'All day' : formatHour(entry.at) }}</strong><small v-if="!entry.allDay">– {{ formatHour(entry.endAt) }}</small></div><span class="entry-dot" aria-hidden="true"></span>
            <div class="entry-copy"><strong>{{ entry.title }}</strong><small>{{ entry.detail }}</small><span v-if="entry.kind==='workout'" class="entry-source">Training · {{ entry.status==='draft'?'in progress':entry.status }}</span></div>
            <button v-if="entry.kind==='task'" class="rhythm-check" :class="{checked:isDone(rhythm,selected,entry)}" :aria-label="(isDone(rhythm,selected,entry)?'Reopen ':'Complete ')+entry.title" :aria-pressed="isDone(rhythm,selected,entry)" @click="toggleTask(entry)"><span aria-hidden="true">{{ isDone(rhythm,selected,entry)?'✓':'' }}</span></button>
            <button v-else-if="entry.kind==='workout'" class="workout-link" @click="emit('workout',selected,entry.workout?.id)">{{ entry.status==='completed'?'View':entry.status==='skipped'?'Restore':entry.status==='draft'?'Resume':'Log workout' }}</button>
            <button v-else-if="entry.kind==='meeting'" class="text-btn" :aria-label="'Edit '+entry.title" @click="openMeeting(entry.id)">Edit</button><span v-else class="fixed-label">Fixed</span>
          </article>
          <div v-if="selected===today&&railHeight" class="rhythm-time-rail" :style="{height:railHeight+'px','--elapsed':elapsed+'px'}" role="img" :aria-label="'Current time '+formatHour(hourNow(now))+' Eastern'"><i></i><b></b></div>
        </div>
        <div class="day-panel-footer"><span>{{ dayProgress.done }} / {{ dayProgress.total }} complete</span><div class="rhythm-mini-track"><i :style="{width:(dayProgress.total?dayProgress.done/dayProgress.total*100:0)+'%'}"></i></div><button class="text-btn" @click="resetDay">Reset day</button></div>
      </section>
      <aside class="rhythm-sidebar">
        <section class="rhythm-card goals-card"><div class="rhythm-card-head"><div><div class="eyebrow">MAKE THIS WEEK COUNT</div><h2>Weekly goals</h2></div><strong class="count-accent">{{ goalsDone }}<small> / {{ meaningfulGoals.length }}</small></strong></div><div class="rhythm-mini-track goals-track"><i :style="{width:(meaningfulGoals.length?goalsDone/meaningfulGoals.length*100:0)+'%'}"></i></div>
          <div class="rhythm-goals"><div v-for="(goal,i) in goals" :key="weekKey+'-'+i" class="rhythm-goal" :class="{done:goal.done}"><span class="goal-index">{{ String(i+1).padStart(2,'0') }}</span><div class="goal-copy"><textarea :value="goal.text" :aria-label="'Weekly goal '+(i+1)" placeholder="Add a weekly goal" rows="2" maxlength="4000" @input="setGoal(i,'text',($event.target as HTMLTextAreaElement).value)"></textarea><small v-if="goal.carriedFrom" class="goal-origin">From {{ formatDate(goal.carriedFrom,{month:'short',day:'numeric'}) }}</small></div><button class="rhythm-check" :class="{checked:goal.done}" :disabled="!goal.text.trim()" :aria-label="(goal.done?'Reopen':'Complete')+' weekly goal '+(i+1)" :aria-pressed="goal.done" @click="setGoal(i,'done',!goal.done)">{{ goal.done?'✓':'' }}</button></div></div>
        </section>
        <section class="rhythm-card"><div class="rhythm-card-head"><h2>Body check</h2><span class="muted">{{ basicsCount }} / 6</span></div><div class="basics-grid"><button v-for="basic in basics" :key="basic.key" :class="{checked:daily[basic.key]}" :aria-pressed="Boolean(daily[basic.key])" @click="setDaily(basic.key,!daily[basic.key])"><strong>{{ basic.label }} <span v-if="daily[basic.key]">✓</span></strong><small>{{ basic.detail }}</small></button></div><div class="water-row"><span><strong>Water</strong><small>{{ Number(daily.water||0)*30 }} / 90 oz</small></span><div><button v-for="n in 3" :key="n" :class="{checked:Number(daily.water||0)>=n}" :aria-label="n*30+' ounces of water'" :aria-pressed="Number(daily.water||0)>=n" @click="setDaily('water',Number(daily.water||0)===n?n-1:n)">{{ n }}</button></div></div></section>
        <section class="rhythm-card"><div class="rhythm-card-head"><h2>Momentum</h2><strong class="count-accent">{{ momentum===null?'—':momentum+'%' }}</strong></div><div class="momentum-grid"><div><small>Walk streak</small><strong>{{ streak('walk') }}<small> days</small></strong></div><div><small>Read streak</small><strong>{{ streak('read') }}<small> days</small></strong></div><button @click="emit('training')"><small>Workouts</small><strong>{{ weeklyLifts }}<small> / {{ store.state.settings?.weeklyWorkoutGoal||3 }}</small></strong></button><div><small>Builds</small><strong>{{ weeklyBuilds }}<small> / 2</small></strong></div></div><p class="rhythm-footnote">Workouts update when you save them in Training.</p></section>
        <details v-if="rhythm.importedAt" class="rhythm-transfer-details"><summary>Rhythm transfer</summary><p>Your saved Rhythm data was imported {{ formatDate(rhythm.importedAt.slice(0,10),{month:'short',day:'numeric'}) }}. Use Homebase for new changes.</p><button class="text-btn" @click="startTransfer">Bring in Rhythm again</button><button class="text-btn" @click="transferFile?.click()">Import transfer file</button><p v-if="rhythm.snapshotUpdatedAt">Calendar snapshot updated {{ rhythm.snapshotUpdatedAt }}. Add new meetings here as needed.</p></details>
      </aside>
    </div>
    <dialog ref="dialog" class="homebase-meeting-dialog" aria-labelledby="meeting-title"><form @submit.prevent="saveMeeting"><div class="rhythm-card-head"><h2 id="meeting-title">{{ meeting.id?'Edit meeting':'Add meeting' }}</h2><button type="button" class="ghost icon" aria-label="Close meeting" @click="dialog?.close()">×</button></div><label>Name<input v-model="meeting.title" required maxlength="160" autocomplete="off" /></label><label>Date<input v-model="meeting.date" type="date" required /></label><div class="meeting-times"><label>Start<input v-model="meeting.start" type="time" required /></label><label>End<input v-model="meeting.end" type="time" required /></label></div><p class="rhythm-footnote">Eastern time · saved privately in Homebase</p><p v-if="meetingError" class="error-note" role="alert">{{ meetingError }}</p><div class="meeting-actions"><button v-if="meeting.id" class="danger" type="button" @click="deleteMeeting">Delete</button><button class="ghost" type="button" @click="dialog?.close()">Cancel</button><button class="primary" type="submit">Save meeting</button></div></form></dialog>
  </section>
</template>
