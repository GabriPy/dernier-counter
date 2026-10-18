export interface Player {
  id: number;
  name: string;
  created_at: string;
  is_active: boolean;
}

export interface PlayerStats {
  hands_won: number;
  games_won: number;
  games_played: number;
  total_points_paid: number;
}

export interface PlayerStatsResponse extends PlayerStats {
  player: Player;
}

export interface GamePlayer {
  id: number;
  name: string;
}

export interface Game {
  id: number;
  started_at: string;
  ended_at: string | null;
  status: 'in_progress' | 'finished';
  winner_id: number | null;
  winner_name: string | null;
  total_points: number;
  total_hands: number;
  winner_hands_won: number;
  players: GamePlayer[];
}

export interface HandScore {
  player_id: number;
  name: string;
  points: number;
}

export interface Hand {
  id: number;
  game_id: number;
  hand_number: number;
  winner_id: number;
  winner_name?: string;
  scores: HandScore[];
}

export interface Standing {
  player_id: number;
  name: string;
  total_points_paid: number;
}

export interface GameDetail extends Game {
  hands: Hand[];
  standings: Standing[];
}
