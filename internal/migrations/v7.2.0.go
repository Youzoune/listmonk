package migrations

import (
	"log"

	"github.com/jmoiron/sqlx"
	"github.com/knadh/koanf/v2"
	"github.com/knadh/stuffbin"
)

// V7_2_0 isolates projects: each project gets its own default template.
func V7_2_0(db *sqlx.DB, fs stuffbin.FileSystem, ko *koanf.Koanf, lo *log.Logger) error {
	if _, err := db.Exec(`
-- Every insert now names its project: an omission must fail instead of
-- silently landing in the default project.
ALTER TABLE subscribers ALTER COLUMN project_id DROP DEFAULT;
ALTER TABLE lists ALTER COLUMN project_id DROP DEFAULT;
ALTER TABLE campaigns ALTER COLUMN project_id DROP DEFAULT;
ALTER TABLE templates ALTER COLUMN project_id DROP DEFAULT;
ALTER TABLE media ALTER COLUMN project_id DROP DEFAULT;

-- The default template was unique across the instance; it's now unique per project.
DROP INDEX IF EXISTS templates_is_default_idx;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tpl_project_default ON templates (project_id) WHERE is_default = true;

-- Projects created before this upgrade get a copy of the default project's default template.
INSERT INTO templates (project_id, name, type, subject, body, body_source, is_default)
    SELECT p.id, t.name, t.type, t.subject, t.body, t.body_source, true
    FROM projects p
    JOIN templates t ON (t.project_id = 1 AND t.is_default = true)
    WHERE p.id != 1 AND NOT EXISTS (SELECT 1 FROM templates WHERE project_id = p.id AND is_default = true);

-- Subscriptions and campaign lists can only link rows of the same project.
-- Rows that would cross projects are silently skipped. Handlers check
-- ownership and report errors; this is the last line of defence.
CREATE OR REPLACE FUNCTION same_project_list() RETURNS TRIGGER AS $$
DECLARE
    owner_project INT;
BEGIN
    IF NEW.list_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'subscriber_lists' THEN
        SELECT project_id INTO owner_project FROM subscribers WHERE id = NEW.subscriber_id;
    ELSE
        SELECT project_id INTO owner_project FROM campaigns WHERE id = NEW.campaign_id;
    END IF;

    IF owner_project IS DISTINCT FROM (SELECT project_id FROM lists WHERE id = NEW.list_id) THEN
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sub_lists_same_project ON subscriber_lists;
CREATE TRIGGER trg_sub_lists_same_project BEFORE INSERT OR UPDATE OF subscriber_id, list_id ON subscriber_lists
    FOR EACH ROW EXECUTE FUNCTION same_project_list();

DROP TRIGGER IF EXISTS trg_camp_lists_same_project ON campaign_lists;
CREATE TRIGGER trg_camp_lists_same_project BEFORE INSERT OR UPDATE OF campaign_id, list_id ON campaign_lists
    FOR EACH ROW EXECUTE FUNCTION same_project_list();
	`); err != nil {
		return err
	}

	return nil
}
