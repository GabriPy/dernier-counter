<template>
  <v-container class="py-6" max-width="1000">
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold mb-1">Nuova partita</h1>
      <p class="text-body-2 text-medium-emphasis mb-0">
        {{ game ? 'Registra le mani una alla volta. Alla fine chiudi la partita.' : 'Scegli chi si siede al tavolo.' }}
      </p>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
      {{ error }}
    </v-alert>

    <!-- Fase 1: selezione giocatori -->
    <v-card v-if="!game" class="player-card">
      <v-card-item>
        <template #prepend>
          <v-avatar color="secondary" variant="tonal">
            <v-icon>mdi-account-multiple-plus</v-icon>
          </v-avatar>
        </template>
        <v-card-title>Partecipanti</v-card-title>
        <v-card-subtitle>Minimo 2 giocatori attivi.</v-card-subtitle>
      </v-card-item>

      <v-card-text>
        <v-skeleton-loader v-if="loading" type="text" />
        <v-alert v-else-if="!activePlayers.length" type="info" variant="tonal" density="compact">
          Nessun giocatore attivo. Creane uno dalla sezione
          <router-link :to="{ name: 'players' }" class="text-secondary">Giocatori</router-link>.
        </v-alert>
        <v-select
          v-else
          v-model="selected"
          :items="activePlayers"
          item-title="name"
          item-value="id"
          label="Giocatori"
          multiple
          chips
          closable-chips
          prepend-inner-icon="mdi-account-group"
        />
      </v-card-text>

      <v-card-actions class="pa-4 pt-0">
        <v-spacer />
        <v-btn
          color="primary"
          prepend-icon="mdi-play"
          :loading="creating"
          :disabled="selected.length < 2"
          @click="createGame"
        >
          Inizia partita
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Fase 2: registrazione mani -->
    <template v-else>
      <v-card class="player-card mb-6" variant="tonal">
        <v-card-text class="d-flex flex-wrap align-center ga-2">
          <v-icon color="secondary">mdi-account-group</v-icon>
          <v-chip v-for="player in game.players" :key="player.id" size="small" variant="outlined">
            {{ player.name }}
          </v-chip>
          <v-spacer />
          <v-chip color="warning" size="small" variant="tonal">
            {{ hands.length }} {{ hands.length === 1 ? 'mano giocata' : 'mani giocate' }}
          </v-chip>
        </v-card-text>
      </v-card>

      <HandForm
        :game-id="game.id"
        :players="game.players"
        class="mb-6"
        @hand-added="onHandAdded"
        @finish-request="askFinish"
      />

      <v-card v-if="hands.length" class="player-card">
        <v-card-title class="pa-4 pb-0 text-h6">Riepilogo</v-card-title>
        <v-card-text>
          <v-table density="compact">
            <thead>
              <tr>
                <th>#</th>
                <th v-for="player in game.players" :key="player.id" class="text-center">
                  {{ player.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hand in hands" :key="hand.id">
                <td>{{ hand.hand_number }}</td>
                <td
                  v-for="player in game.players"
                  :key="player.id"
                  class="text-center"
                  :class="pointsFor(hand, player.id) === 0 ? 'text-primary font-weight-bold' : ''"
                >
                  {{ pointsFor(hand, player.id) }}
                </td>
              </tr>
              <tr>
                <td class="font-weight-bold">Totale</td>
                <td
                  v-for="player in game.players"
                  :key="player.id"
                  class="text-center font-weight-bold"
                >
                  {{ totals[player.id] ?? 0 }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </template>

    <v-dialog v-model="confirmFinish.open" max-width="440">
      <v-card>
        <v-card-title>Chiudere la partita?</v-card-title>
        <v-card-text>
          Verranno calcolati vincitore, punti totali e numero di mani. L'operazione non è reversibile.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmFinish.open = false">Annulla</v-btn>
          <v-btn color="secondary" :loading="confirmFinish.saving" @click="finishGame">
            Chiudi partita
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import HandForm from '../components/HandForm.vue';
import type { Game, Hand, Player } from '../types';

const router = useRouter();

const activePlayers = ref<Player[]>([]);
const selected = ref<number[]>([]);
const loading = ref(true);
const creating = ref(false);
const error = ref('');

const game = ref<Game | null>(null);
const hands = ref<Hand[]>([]);

const confirmFinish = reactive({ open: false, saving: false });

const totals = computed<Record<number, number>>(() => {
  const result: Record<number, number> = {};
  for (const hand of hands.value) {
    for (const score of hand.scores) {
      result[score.player_id] = (result[score.player_id] ?? 0) + score.points;
    }
  }
  return result;
});

function pointsFor(hand: Hand, playerId: number): number {
  return hand.scores.find((score) => score.player_id === playerId)?.points ?? 0;
}

async function loadPlayers(): Promise<void> {
  loading.value = true;
  try {
    activePlayers.value = await api.players.list(false);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

async function createGame(): Promise<void> {
  creating.value = true;
  error.value = '';
  try {
    game.value = await api.games.create(selected.value);
    hands.value = [];
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    creating.value = false;
  }
}

function onHandAdded(hand: Hand): void {
  hands.value.push(hand);
}

function askFinish(): void {
  if (hands.value.length === 0) {
    error.value = 'Registra almeno una mano prima di chiudere la partita.';
    return;
  }
  confirmFinish.open = true;
}

async function finishGame(): Promise<void> {
  if (!game.value) return;

  confirmFinish.saving = true;
  try {
    const finished = await api.games.finish(game.value.id);
    confirmFinish.open = false;
    router.push({ name: 'game-detail', params: { id: finished.id } });
  } catch (err) {
    confirmFinish.open = false;
    error.value = (err as Error).message;
  } finally {
    confirmFinish.saving = false;
  }
}

onMounted(loadPlayers);
</script>
