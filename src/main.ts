import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './tokens.css'
import './style.css'
import './homebase.css'
import './identity.css'
import './motion.css'
import './evolution.css'

createApp(App).use(createPinia()).mount('#app')
