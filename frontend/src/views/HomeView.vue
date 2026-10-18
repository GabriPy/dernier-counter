<template>
  <v-container class="py-6" max-width="1200">
    <div class="d-flex flex-wrap align-end justify-space-between ga-4 mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1">Tavolo</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">Le ultime 10 partite registrate.</p>
      </div>
      <div class="d-flex ga-2">
        <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'new-game' }">
          Nuova partita
        </v-btn>
        <v-btn color="secondary" variant="tonal" prepend-icon="mdi-account-group" :to="{ name: 'players' }">
          Giocatori
        </v-btn>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" @click="load">Riprova</v-btn>
      </template>
    </v-alert>

    <v-row v-if="loading">
      <v-col v-for="n in 3" :key="n" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <v-row v-else-if="games.length">
      <v-col v-for="game in games" :key="game.id" cols="12" md="6" lg="4">
        <GameSummaryCard :game="game" />
      </v-col>
    </v-row>

    <v-card v-else class="pa-10 text-center" variant="tonal">
      <v-icon size="56" color="secondary">mdi-cards-playing-outline</v-icon>
      <h2 class="text-h6 mt-4 mb-1">Nessuna partita in archivio</h2>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Inizia a registrare le mani per vedere qui statistiche e classifiche.
      </p>
      <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'new-game' }">
        Crea la prima partita
      </v-btn>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import GameSummaryCard from '../components/GameSummaryCard.vue';
import type { Game } from '../types';

const games = ref<Game[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    games.value = await api.games.list(10);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
