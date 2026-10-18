<template>
  <v-card class="game-card h-100 d-flex flex-column" @click="openDetail">
    <v-card-item>
      <template #prepend>
        <v-avatar :color="isFinished ? 'secondary' : 'warning'" variant="tonal" size="42">
          <v-icon>{{ isFinished ? 'mdi-trophy-variant' : 'mdi-progress-clock' }}</v-icon>
        </v-avatar>
      </template>

      <v-card-title class="text-h6">
        {{ isFinished ? (game.winner_name ?? 'Vincitore sconosciuto') : 'Partita in corso' }}
      </v-card-title>
      <v-card-subtitle>{{ formatDateTime(game.started_at) }}</v-card-subtitle>

      <template #append>
        <v-chip :color="isFinished ? 'success' : 'warning'" size="small" variant="tonal">
          {{ isFinished ? 'Conclusa' : 'In corso' }}
        </v-chip>
      </template>
    </v-card-item>

    <v-card-text class="flex-grow-1">
      <div class="d-flex mb-4">
        <div class="stat">
          <span class="stat-value text-primary">{{ game.total_points }}</span>
          <span class="stat-label">punti pagati</span>
        </div>
        <v-divider vertical class="mx-2" />
        <div class="stat">
          <span class="stat-value">{{ game.total_hands }}</span>
          <span class="stat-label">mani</span>
        </div>
        <v-divider vertical class="mx-2" />
        <div class="stat">
          <span class="stat-value text-secondary">{{ game.winner_hands_won }}</span>
          <span class="stat-label">mani vinte</span>
        </div>
      </div>

      <div class="d-flex flex-wrap ga-1">
        <v-chip
          v-for="player in game.players"
          :key="player.id"
          size="small"
          variant="outlined"
          :color="player.id === game.winner_id ? 'secondary' : undefined"
        >
          <v-icon v-if="player.id === game.winner_id" start size="14">mdi-crown</v-icon>
          {{ player.name }}
        </v-chip>
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn variant="text" color="secondary" append-icon="mdi-chevron-right" block>
        Apri dettaglio
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { Game } from '../types';
import { formatDateTime } from '../utils/format';

const props = defineProps<{ game: Game }>();
const router = useRouter();

const isFinished = computed(() => props.game.status === 'finished');

function openDetail(): void {
  router.push({ name: 'game-detail', params: { id: props.game.id } });
}
</script>
