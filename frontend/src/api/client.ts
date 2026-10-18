import type {
  Game,
  GameDetail,
  Hand,
  Player,
  PlayerStatsResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    let message = `Errore ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // risposta priva di body JSON: manteniamo il messaggio di default
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  players: {
    list: (includeInactive = false): Promise<Player[]> =>
      request<Player[]>(`/players${includeInactive ? '?include_inactive=true' : ''}`),

    create: (name: string): Promise<Player> =>
      request<Player>('/players', { method: 'POST', body: JSON.stringify({ name }) }),

    update: (id: number, payload: { name?: string; is_active?: boolean }): Promise<Player> =>
      request<Player>(`/players/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

    remove: (id: number): Promise<Player> =>
      request<Player>(`/players/${id}`, { method: 'DELETE' }),

    stats: (id: number): Promise<PlayerStatsResponse> =>
      request<PlayerStatsResponse>(`/players/${id}/stats`),
  },

  games: {
    list: (limit = 10): Promise<Game[]> => request<Game[]>(`/games?limit=${limit}`),

    get: (id: number): Promise<GameDetail> => request<GameDetail>(`/games/${id}`),

    create: (playerIds: number[]): Promise<Game> =>
      request<Game>('/games', { method: 'POST', body: JSON.stringify({ player_ids: playerIds }) }),

    finish: (id: number): Promise<Game> =>
      request<Game>(`/games/${id}/finish`, { method: 'PATCH' }),
  },

  hands: {
    create: (
      gameId: number,
      scores: { player_id: number; points: number }[]
    ): Promise<Hand> =>
      request<Hand>(`/games/${gameId}/hands`, {
        method: 'POST',
        body: JSON.stringify({ scores }),
      }),
  },
};
