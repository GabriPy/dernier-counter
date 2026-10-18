import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue'),
      meta: { title: 'Home' },
    },
    {
      path: '/players',
      name: 'players',
      component: () => import('./views/PlayersView.vue'),
      meta: { title: 'Giocatori' },
    },
    {
      path: '/games/new',
      name: 'new-game',
      component: () => import('./views/NewGameView.vue'),
      meta: { title: 'Nuova partita' },
    },
    {
      path: '/games/:id',
      name: 'game-detail',
      component: () => import('./views/GameDetailView.vue'),
      props: true,
      meta: { title: 'Dettaglio partita' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  const title = to.meta?.title as string | undefined;
  document.title = title ? `${title} · Dernier` : 'Dernier';
});
