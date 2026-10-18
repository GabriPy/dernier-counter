<template>
  <v-card class="player-card">
    <v-card-item>
      <template #prepend>
        <v-avatar color="primary" variant="tonal">
          <v-icon>mdi-cards-outline</v-icon>
        </v-avatar>
      </template>
      <v-card-title>Nuova mano</v-card-title>
      <v-card-subtitle>
        Assegna i punti: chi fa 0 vince la mano, gli altri pagano le carte.
      </v-card-subtitle>
    </v-card-item>

    <v-card-text>
      <v-row dense>
        <v-col
          v-for="player in players"
          :key="player.id"
          cols="6"
          sm="4"
          md="3"
        >
          <v-text-field
            v-model.number="values[player.id]"
            class="score-input"
            type="number"
            min="0"
            step="1"
            :label="player.name"
            :error-messages="fieldErrors[player.id]"
            :color="values[player.id] === 0 ? 'primary' : undefined"
            :prepend-inner-icon="values[player.id] === 0 ? 'mdi-crown' : undefined"
            hide-details="auto"
          />
        </v-col>
      </v-row>

      <v-alert
        v-if="formError"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-4"
      >
        {{ formError }}
      </v-alert>

      <v-alert v-else-if="winnerPreview" type="success" variant="tonal" density="compact" class="mt-4">
        Vince la mano: <strong>{{ winnerPreview }}</strong>
      </v-alert>
    </v-card-text>

    <v-card-actions class="pa-4 pt-0 flex-wrap ga-2">
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        :loading="submitting"
        @click="submitHand"
      >
        Aggiungi mano
      </v-btn>
      <v-spacer />
      <v-btn
        color="secondary"
        variant="tonal"
        prepend-icon="mdi-flag-checkered"
        @click="emit('finish-request')"
      >
        Chiudi partita
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { api } from '../api/client';
import type { GamePlayer, Hand } from '../types';

const props = defineProps<{
  gameId: number;
  players: GamePlayer[];
}>();

const emit = defineEmits<{
  (event: 'hand-added', hand: Hand): void;
  (event: 'finish-request'): void;
}>();

type ScoreValue = number | null;

const values = reactive<Record<number, ScoreValue>>(
  Object.fromEntries(props.players.map((player) => [player.id, null])) as Record<number, ScoreValue>
);
const fieldErrors = ref<Record<number, string>>({});
const formError = ref('');
const submitting = ref(false);

const winnerPreview = computed(() => {
  const winner = props.players.find((player) => values[player.id] === 0);
  const zeroCount = props.players.filter((player) => values[player.id] === 0).length;
  return zeroCount === 1 && winner ? winner.name : '';
});

function validate(): boolean {
  const errors: Record<number, string> = {};

  for (const player of props.players) {
    const value = values[player.id];
    if (value === null || value === undefined || Number.isNaN(value)) {
      errors[player.id] = 'Campo obbligatorio';
    } else if (!Number.isInteger(value) || value < 0) {
      errors[player.id] = 'Intero ≥ 0';
    }
  }

  fieldErrors.value = errors;
  if (Object.keys(errors).length > 0) {
    formError.value = 'Compila tutti i campi con valori validi.';
    return false;
  }

  const zeroCount = props.players.filter((player) => values[player.id] === 0).length;
  if (zeroCount === 0) {
    formError.value = 'Serve un giocatore con 0 punti: è lui il vincitore della mano.';
    return false;
  }
  if (zeroCount > 1) {
    formError.value = 'Solo un giocatore può avere 0 punti in una mano.';
    return false;
  }

  formError.value = '';
  return true;
}

async function submitHand(): Promise<void> {
  if (submitting.value || !validate()) {
    return;
  }

  submitting.value = true;
  try {
    const hand = await api.hands.create(
      props.gameId,
      props.players.map((player) => ({
        player_id: player.id,
        points: values[player.id] as number,
      }))
    );

    for (const player of props.players) {
      values[player.id] = null;
    }
    fieldErrors.value = {};
    emit('hand-added', hand);
  } catch (err) {
    formError.value = (err as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>
