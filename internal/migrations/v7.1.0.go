package migrations

import (
	"log"

	"github.com/jmoiron/sqlx"
	"github.com/knadh/koanf/v2"
	"github.com/knadh/stuffbin"
)

// V7_1_0 introduces projects (workspaces). Every existing list, subscriber,
// campaign, template and media item is moved into the default project (ID 1).
func V7_1_0(db *sqlx.DB, fs stuffbin.FileSystem, ko *koanf.Koanf, lo *log.Logger) error {
	lo.Println("IMPORTANT: this upgrade might take a while if you have a large database. Please be patient ...")

	if _, err := db.Exec(`
CREATE TABLE IF NOT EXISTS projects (
    id              SERIAL PRIMARY KEY,
    uuid            uuid NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    domain          TEXT NULL UNIQUE,
    description     TEXT NOT NULL DEFAULT '',

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO projects (id, uuid, name, slug) VALUES (1, gen_random_uuid(), 'Default', 'default')
    ON CONFLICT DO NOTHING;
SELECT SETVAL('projects_id_seq', (SELECT MAX(id) FROM projects));

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_subs_project_id ON subscribers(project_id);
CREATE INDEX IF NOT EXISTS idx_lists_project_id ON lists(project_id);
CREATE INDEX IF NOT EXISTS idx_camps_project_id ON campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_tpl_project_id ON templates(project_id);
CREATE INDEX IF NOT EXISTS idx_media_project_id ON media(project_id);

-- An e-mail is now unique within a project instead of the whole instance.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subs_project_email ON subscribers(project_id, LOWER(email));
ALTER TABLE subscribers DROP CONSTRAINT IF EXISTS subscribers_email_key;
DROP INDEX IF EXISTS idx_subs_email;

CREATE TABLE IF NOT EXISTS user_projects (
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY(user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_user_projects_project_id ON user_projects(project_id);

-- Existing users keep access to everything they had, which is the default project.
INSERT INTO user_projects (user_id, project_id) SELECT id, 1 FROM users ON CONFLICT DO NOTHING;

-- Project permissions for the Super Admin role.
UPDATE roles SET permissions = permissions || '{projects:get,projects:manage}'
    WHERE id = 1 AND NOT permissions @> '{projects:get,projects:manage}';
	`); err != nil {
		return err
	}

	return nil
}
