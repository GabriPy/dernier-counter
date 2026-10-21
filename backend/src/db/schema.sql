-- Schema del database "dernier"
-- Eseguito automaticamente da Postgres al primo avvio del container (docker-entrypoint-initdb.d)

CREATE TABLE IF NOT EXISTS players (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS games (
  id               SERIAL PRIMARY KEY,
  started_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMP NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress', 'finished')),
  winner_id        INT REFERENCES players(id),
  total_points     INT NOT NULL DEFAULT 0,
  total_hands      INT NOT NULL DEFAULT 0,
  -- aggiornata a ogni mano: serve a chiudere le partite inattive
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_players (
  id         SERIAL PRIMARY KEY,
  game_id    INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id  INT NOT NULL REFERENCES players(id),
  seat_order INT,
  UNIQUE (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS hands (
  id          SERIAL PRIMARY KEY,
  game_id     INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  hand_number INT NOT NULL,
  winner_id   INT NOT NULL REFERENCES players(id),
  UNIQUE (game_id, hand_number)
);

CREATE TABLE IF NOT EXISTS hand_scores (
  id        SERIAL PRIMARY KEY,
  hand_id   INT NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES players(id),
  points    INT NOT NULL CHECK (points >= 0),
  UNIQUE (hand_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game   ON game_players (game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player ON game_players (player_id);
CREATE INDEX IF NOT EXISTS idx_hands_game          ON hands (game_id);
CREATE INDEX IF NOT EXISTS idx_hands_winner        ON hands (winner_id);
CREATE INDEX IF NOT EXISTS idx_hand_scores_hand    ON hand_scores (hand_id);
CREATE INDEX IF NOT EXISTS idx_hand_scores_player  ON hand_scores (player_id);
CREATE INDEX IF NOT EXISTS idx_games_started_at    ON games (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_stale         ON games (last_activity_at) WHERE status = 'in_progress';
