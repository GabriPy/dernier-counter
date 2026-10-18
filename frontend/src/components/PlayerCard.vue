<template>
  <v-expansion-panel :value="player.id" class="player-card">
    <v-expansion-panel-title>
      <div class="d-flex align-center ga-3">
        <v-avatar :color="player.is_active ? 'primary' : 'grey'" variant="tonal" size="36">
          <v-icon size="20">mdi-account</v-icon>
        </v-avatar>
        <div>
          <div class="font-weight-medium">{{ player.name }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ player.is_active ? 'Attivo' : 'Non attivo' }}
          </div>
        </div>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-skeleton-loader v-if="loading" type="text" />
      <v-alert v-else-if="error" type="error" variant="tonal" density="compact">
        {{ error }}
      </v-alert>
      <div v-else-if="stats" class="d-flex">
        <div class="stat">
          <span class="stat-value text-secondary">{{ stats.hands_won }}</span>
          <span class="stat-label">mani vinte</span>
        </div>
        <v-divider vertical class="mx-2" />
        <div class="stat">
          <span class="stat-value text-primary">{{ stats.total_points_paid }}</span>
          <span class="stat-label">punti pagati</span>
        </div>
        <v-divider vertical class="mx-2" />
        <div class="stat">
          <span class="stat-value">{{ stats.games_played }}</span>
          <span class="stat-label">partite giocate</span>
        </div>
        <v-divider vertical class="mx-2" />
        <div class="stat">
          <span class="stat-value text-success">{{ stats.games_won }}</span>
          <span class="stat-label">partite vinte</span>
        </div>
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Player, PlayerStats } from '../types';

const props = defineProps<{ player: Player }>();

const stats = ref<PlayerStats | null>(null);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const response = await api.players.stats(props.player.id);
    stats.value = response;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>
