-- name: get-dashboard-charts
SELECT data FROM mat_dashboard_charts;

-- name: get-dashboard-counts
SELECT data FROM mat_dashboard_counts;

-- name: get-settings
SELECT JSON_OBJECT_AGG(key, value) AS settings FROM (SELECT * FROM settings ORDER BY key) t;

-- name: update-settings
UPDATE settings AS s SET value = c.value
    -- For each key in the incoming JSON map, update the row with the key and its value.
    FROM(SELECT * FROM JSONB_EACH($1)) AS c(key, value) WHERE s.key = c.key;

-- name: update-settings-by-key
UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1;

-- name: get-db-info
SELECT JSON_BUILD_OBJECT('version', (SELECT VERSION()),
                        'size_mb', (SELECT ROUND(pg_database_size((SELECT CURRENT_DATABASE()))/(1024^2)))) AS info;

-- name: get-project-dashboard-counts
-- Live dashboard counts for one project. The instance-wide counts come from
-- the mat_dashboard_counts cache instead.
WITH subs AS (
    SELECT COUNT(*) AS num, status FROM subscribers WHERE project_id = $1 GROUP BY status
)
SELECT JSON_BUILD_OBJECT(
    'subscribers', JSON_BUILD_OBJECT(
        'total', COALESCE((SELECT SUM(num) FROM subs), 0),
        'blocklisted', COALESCE((SELECT num FROM subs WHERE status='blocklisted'), 0),
        'orphans', (
            SELECT COUNT(id) FROM subscribers
            LEFT JOIN subscriber_lists ON (subscribers.id = subscriber_lists.subscriber_id)
            WHERE subscriber_lists.subscriber_id IS NULL AND subscribers.project_id = $1
        )
    ),
    'lists', JSON_BUILD_OBJECT(
        'total', (SELECT COUNT(*) FROM lists WHERE project_id = $1),
        'private', (SELECT COUNT(*) FROM lists WHERE project_id = $1 AND type='private'),
        'public', (SELECT COUNT(*) FROM lists WHERE project_id = $1 AND type='public'),
        'optin_single', (SELECT COUNT(*) FROM lists WHERE project_id = $1 AND optin='single'),
        'optin_double', (SELECT COUNT(*) FROM lists WHERE project_id = $1 AND optin='double')
    ),
    'campaigns', JSON_BUILD_OBJECT(
        'total', (SELECT COUNT(*) FROM campaigns WHERE project_id = $1),
        'by_status', COALESCE((
            SELECT JSON_OBJECT_AGG(status, num) FROM
            (SELECT status, COUNT(*) AS num FROM campaigns WHERE project_id = $1 GROUP BY status) r
        ), '{}')
    ),
    'messages', COALESCE((SELECT SUM(sent) FROM campaigns WHERE project_id = $1), 0)
);

-- name: get-project-dashboard-charts
-- Live 30-day view and click charts for one project.
WITH clicks AS (
    SELECT JSON_AGG(ROW_TO_JSON(row))
    FROM (
        WITH dates AS (
            SELECT MAX(lc.created_at)::DATE AS to_date FROM link_clicks lc
            JOIN campaigns c ON (c.id = lc.campaign_id) WHERE c.project_id = $1
        )
        SELECT COUNT(*) AS count, lc.created_at::DATE AS date FROM link_clicks lc
            JOIN campaigns c ON (c.id = lc.campaign_id)
            WHERE c.project_id = $1
            AND lc.created_at >= (SELECT to_date FROM dates) - INTERVAL '30 DAY'
            AND lc.created_at < (SELECT to_date FROM dates) + INTERVAL '1 day'
            GROUP BY date ORDER BY date
    ) row
),
views AS (
    SELECT JSON_AGG(ROW_TO_JSON(row))
    FROM (
        WITH dates AS (
            SELECT MAX(cv.created_at)::DATE AS to_date FROM campaign_views cv
            JOIN campaigns c ON (c.id = cv.campaign_id) WHERE c.project_id = $1
        )
        SELECT COUNT(*) AS count, cv.created_at::DATE AS date FROM campaign_views cv
            JOIN campaigns c ON (c.id = cv.campaign_id)
            WHERE c.project_id = $1
            AND cv.created_at >= (SELECT to_date FROM dates) - INTERVAL '30 DAY'
            AND cv.created_at < (SELECT to_date FROM dates) + INTERVAL '1 day'
            GROUP BY date ORDER BY date
    ) row
)
SELECT JSON_BUILD_OBJECT('link_clicks', COALESCE((SELECT * FROM clicks), '[]'),
                         'campaign_views', COALESCE((SELECT * FROM views), '[]'));
