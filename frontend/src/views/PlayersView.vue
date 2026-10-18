<template>
  <v-container class="py-6" max-width="1200">
    <div class="d-flex flex-wrap align-end justify-space-between ga-4 mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1">Giocatori</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Gestisci l'anagrafica e consulta le statistiche di ognuno.
        </p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreateDialog">
        Nuovo giocatore
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
      {{ error }}
    </v-alert>

    <v-card class="player-card mb-6">
      <v-skeleton-loader v-if="loading" type="table" />
      <v-table v-else-if="players.length" hover>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Stato</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in players" :key="player.id">
            <td class="font-weight-medium">{{ player.name }}</td>
            <td>
              <v-chip size="small" variant="tonal" :color="player.is_active ? 'success' : 'grey'">
                {{ player.is_active ? 'Attivo' : 'Non attivo' }}
              </v-chip>
            </td>
            <td class="text-right">
              <v-btn size="small" variant="text" color="secondary" icon="mdi-pencil" @click="openEditDialog(player)" />
              <v-btn
                size="small"
                variant="text"
                :color="player.is_active ? 'error' : 'success'"
                :icon="player.is_active ? 'mdi-account-off' : 'mdi-account-check'"
                @click="toggleActive(player)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-card-text v-else class="text-center py-8 text-medium-emphasis">
        Nessun giocatore. Aggiungine uno per iniziare.
      </v-card-text>
    </v-card>

    <h2 class="text-h6 mb-3">Statistiche per giocatore</h2>
    <v-expansion-panels v-if="players.length" variant="accordion">
      <PlayerCard v-for="player in players" :key="player.id" :player="player" />
    </v-expansion-panels>

    <!-- Dialog crea/modifica -->
    <v-dialog v-model="dialog.open" max-width="440">
      <v-card>
        <v-card-title>{{ dialog.mode === 'create' ? 'Nuovo giocatore' : 'Modifica giocatore' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="dialog.name"
            label="Nome"
            autofocus
            :error-messages="dialog.error"
            @keyup.enter="savePlayer"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog.open = false">Annulla</v-btn>
          <v-btn color="primary" :loading="dialog.saving" @click="savePlayer">Salva</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog conferma disattivazione -->
    <v-dialog v-model="confirmDialog.open" max-width="420">
      <v-card>
        <v-card-title>Confermi l'operazione?</v-card-title>
        <v-card-text>{{ confirmDialog.message }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDialog.open = false">Annulla</v-btn>
          <v-btn color="error" :loading="confirmDialog.saving" @click="confirmDialog.action?.()">
            Conferma
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api/client';
import PlayerCard from '../components/PlayerCard.vue';
import type { Player } from '../types';

const players = ref<Player[]>([]);
const loading = ref(true);
const error = ref('');

const dialog = reactive({
  open: false,
  mode: 'create' as 'create' | 'edit',
  playerId: null as number | null,
  name: '',
  error: '',
  saving: false,
});

const confirmDialog = reactive({
  open: false,
  message: '',
  saving: false,
  action: null as null | (() => Promise<void>),
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    players.value = await api.players.list(true);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

function openCreateDialog(): void {
  dialog.mode = 'create';
  dialog.playerId = null;
  dialog.name = '';
  dialog.error = '';
  dialog.open = true;
}

function openEditDialog(player: Player): void {
  dialog.mode = 'edit';
  dialog.playerId = player.id;
  dialog.name = player.name;
  dialog.error = '';
  dialog.open = true;
}

async function savePlayer(): Promise<void> {
  const name = dialog.name.trim();
  if (!name) {
    dialog.error = 'Il nome è obbligatorio';
    return;
  }

  dialog.saving = true;
  dialog.error = '';
  try {
    if (dialog.mode === 'create') {
      await api.players.create(name);
    } else if (dialog.playerId !== null) {
      await api.players.update(dialog.playerId, { name });
    }
    dialog.open = false;
    await load();
  } catch (err) {
    dialog.error = (err as Error).message;
  } finally {
    dialog.saving = false;
  }
}

function toggleActive(player: Player): void {
  const deactivating = player.is_active;
  confirmDialog.message = deactivating
    ? `Vuoi disattivare "${player.name}"? Non comparirà più tra i giocatori selezionabili, ma lo storico resterà consultabile.`
    : `Vuoi riattivare "${player.name}"?`;
  confirmDialog.action = async () => {
    confirmDialog.saving = true;
    try {
      await api.players.update(player.id, { is_active: !player.is_active });
      confirmDialog.open = false;
      await load();
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      confirmDialog.saving = false;
    }
  };
  confirmDialog.open = true;
}

onMounted(load);
</script>
