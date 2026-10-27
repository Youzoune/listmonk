package migrations

import (
	"log"

	"github.com/jmoiron/sqlx"
	"github.com/knadh/koanf/v2"
	"github.com/knadh/stuffbin"
)

// V7_4_0 adds per-relay sending cadence and warm-up: daily send counts per
// relay, and the relay that carries the system notifications.
func V7_4_0(db *sqlx.DB, fs stuffbin.FileSystem, ko *koanf.Koanf, lo *log.Logger) error {
	if _, err := db.Exec(`
CREATE TABLE IF NOT EXISTS relay_usage (
    relay           TEXT NOT NULL,
    day             DATE NOT NULL,
    sent            INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (relay, day)
);

-- Empty: the system notifications keep going through the default pool.
INSERT INTO settings (key, value) VALUES ('app.system_messenger', '""') ON CONFLICT DO NOTHING;
	`); err != nil {
		return err
	}

	return nil
}
