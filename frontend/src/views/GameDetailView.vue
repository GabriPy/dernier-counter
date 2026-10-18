<template>
  <v-container class="py-6" max-width="1000">
    <v-btn
      variant="text"
      color="secondary"
      prepend-icon="mdi-arrow-left"
      class="mb-4 ms-n2"
      :to="{ name: 'home' }"
    >
      Torna alla home
    </v-btn>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-skeleton-loader v-if="loading" type="article, table" />

    <template v-else-if="game">
      <v-card class="player-card mb-6">
        <v-card-item>
          <template #prepend>
            <v-avatar :color="isFinished ? 'secondary' : 'warning'" variant="tonal" size="52">
              <v-icon size="28">{{ isFinished ? 'mdi-trophy-variant' : 'mdi-progress-clock' }}</v-icon>
            </v-avatar>
          </template>
          <v-card-title class="text-h5">
            {{ isFinished ? (game.winner_name ?? 'Vincitore sconosciuto') : 'Partita in corso' }}
          </v-card-title>
          <v-card-subtitle>
            Iniziata il {{ formatDateTime(game.started_at) }}
            <template v-if="game.ended_at"> · conclusa il {{ formatDateTime(game.ended_at) }}</template>
          </v-card-subtitle>
          <template #append>
            <v-chip :color="isFinished ? 'success' : 'warning'" variant="tonal">
              {{ isFinished ? 'Conclusa' : 'In corso' }}
            </v-chip>
          </template>
        </v-card-item>

        <v-card-text class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="player in game.players"
            :key="player.id"
            variant="outlined"
            :color="player.id === game.winner_id ? 'secondary' : undefined"
          >
            <v-icon v-if="player.id === game.winner_id" start size="16">mdi-crown</v-icon>
            {{ player.name }}
          </v-chip>
        </v-card-text>

        <v-divider />

        <v-card-text class="d-flex">
          <div class="stat">
            <span class="stat-value text-primary">{{ game.total_points }}</span>
            <span class="stat-label">punti pagati</span>
          </div>
          <v-divider vertical class="mx-2" />
          <div class="stat">
            <span class="stat-value">{{ game.total_hands }}</span>
            <span class="stat-label">mani giocate</span>
          </div>
          <v-divider vertical class="mx-2" />
          <div class="stat">
            <span class="stat-value text-secondary">{{ game.winner_hands_won }}</span>
            <span class="stat-label">mani vinte dal vincitore</span>
          </div>
        </v-card-text>
      </v-card>

      <v-card class="player-card mb-6">
        <v-card-title class="pa-4 pb-0 text-h6">Classifica</v-card-title>
        <v-card-text>
          <v-table hover>
            <thead>
              <tr>
                <th>Giocatore</th>
                <th class="text-right">Punti pagati</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in game.standings" :key="row.player_id">
                <td>
                  <v-icon v-if="row.player_id === game.winner_id" color="secondary" size="18" class="me-1">
                    mdi-crown
                  </v-icon>
                  {{ row.name }}
                </td>
                <td class="text-right font-weight-medium">{{ row.total_points_paid }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <v-card class="player-card">
        <v-card-title class="pa-4 pb-0 text-h6">Mani</v-card-title>
        <v-card-text>
          <v-table v-if="game.hands.length" density="compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Vincitore</th>
                <th v-for="player in game.players" :key="player.id" class="text-center">
                  {{ player.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hand in game.hands" :key="hand.id">
                <td>{{ hand.hand_number }}</td>
                <td class="text-secondary font-weight-medium">{{ hand.winner_name }}</td>
                <td
                  v-for="player in game.players"
                  :key="player.id"
                  class="text-center"
                  :class="handPoints(hand, player.id) === 0 ? 'text-primary font-weight-bold' : ''"
                >
                  {{ handPoints(hand, player.id) }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <p v-else class="text-medium-emphasis mb-0 text-center py-4">
            Nessuna mano registrata.
          </p>
        </v-card-text>
      </v-card>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { GameDetail, Hand } from '../types';
import { formatDateTime } from '../utils/format';

const props = defineProps<{ id: string }>();

const game = ref<GameDetail | null>(null);
const loading = ref(true);
const error = ref('');

const isFinished = computed(() => game.value?.status === 'finished');

function handPoints(hand: Hand, playerId: number): number {
  return hand.scores.find((score) => score.player_id === playerId)?.points ?? 0;
}

onMounted(async () => {
  const numericId = Number(props.id);
  if (!Number.isInteger(numericId)) {
    error.value = 'Partita non valida';
    loading.value = false;
    return;
  }

  try {
    game.value = await api.games.get(numericId);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>
