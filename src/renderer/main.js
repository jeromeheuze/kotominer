import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

import Mining from './views/Mining.vue';
import Pools from './views/Pools.vue';
import AboutKoto from './views/AboutKoto.vue';
import Guide from './views/Guide.vue';
import Faucet from './views/Faucet.vue';
import Games from './views/Games.vue';
import Settings from './views/Settings.vue';
import Benchmark from './views/Benchmark.vue';

const routes = [
  { path: '/', name: 'mining', component: Mining },
  { path: '/benchmark', name: 'benchmark', component: Benchmark },
  { path: '/pools', name: 'pools', component: Pools },
  { path: '/about', name: 'about', component: AboutKoto },
  { path: '/guide', name: 'guide', component: Guide },
  { path: '/faucet', name: 'faucet', component: Faucet },
  { path: '/games', name: 'games', component: Games },
  { path: '/settings', name: 'settings', component: Settings },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

createApp(App).use(router).mount('#app');
