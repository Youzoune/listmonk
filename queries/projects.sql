-- projects
-- name: get-projects
-- Returns all projects ($1 = TRUE) or only the ones the user $2 has access to.
SELECT projects.*,
    (SELECT COUNT(*) FROM lists WHERE lists.project_id = projects.id) AS list_count,
    (SELECT COUNT(*) FROM campaigns WHERE campaigns.project_id = projects.id) AS campaign_count
    FROM projects
    WHERE $1 = TRUE OR id IN (SELECT project_id FROM user_projects WHERE user_id = $2)
    ORDER BY id;

-- name: get-project
SELECT projects.*,
    (SELECT COUNT(*) FROM lists WHERE lists.project_id = projects.id) AS list_count,
    (SELECT COUNT(*) FROM campaigns WHERE campaigns.project_id = projects.id) AS campaign_count
    FROM projects
    WHERE CASE
        WHEN $1 > 0 THEN id = $1
        WHEN $2 != '' THEN uuid = $2::UUID
        ELSE slug = $3
    END;

-- name: create-project
-- A new project starts with a copy of the default project's default template.
WITH p AS (
    INSERT INTO projects (uuid, name, slug, domain, description) VALUES($1, $2, $3, NULLIF($4, ''), $5) RETURNING id
),
t AS (
    INSERT INTO templates (project_id, name, type, subject, body, body_source, is_default)
        SELECT (SELECT id FROM p), name, type, subject, body, body_source, true
        FROM templates WHERE project_id = 1 AND is_default = true
)
SELECT id FROM p;

-- name: update-project
UPDATE projects SET
    name=$2,
    slug=$3,
    domain=NULLIF($4, ''),
    description=$5,
    updated_at=NOW()
WHERE id = $1;

-- name: delete-project
-- The default project (1) can never be deleted. Projects that still hold
-- data are protected by ON DELETE RESTRICT foreign keys.
DELETE FROM projects WHERE id = $1 AND id != 1;

-- name: get-user-project-ids
SELECT COALESCE(ARRAY_AGG(project_id ORDER BY project_id), '{}') FROM user_projects WHERE user_id = $1;

-- name: set-user-projects
WITH del AS (
    DELETE FROM user_projects WHERE user_id = $1 AND NOT (project_id = ANY($2::INT[]))
)
INSERT INTO user_projects (user_id, project_id)
    SELECT $1, UNNEST($2::INT[])
    ON CONFLICT DO NOTHING;
