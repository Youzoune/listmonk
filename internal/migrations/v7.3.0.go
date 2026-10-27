package migrations

import (
	"log"

	"github.com/jmoiron/sqlx"
	"github.com/knadh/koanf/v2"
	"github.com/knadh/stuffbin"
)

// V7_3_0 lets a project's templates go with it: every project gets a default
// template on creation, which must not keep an otherwise empty project alive.
func V7_3_0(db *sqlx.DB, fs stuffbin.FileSystem, ko *koanf.Koanf, lo *log.Logger) error {
	if _, err := db.Exec(`
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_project_id_fkey;
ALTER TABLE templates ADD CONSTRAINT templates_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;
	`); err != nil {
		return err
	}

	return nil
}
