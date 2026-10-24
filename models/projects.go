package models

import (
	null "gopkg.in/volatiletech/null.v6"
)

// DefaultProjectID is the ID of the primordial project that cannot be deleted.
// Data created before projects existed lives in it.
const DefaultProjectID = 1

// Project represents a project (workspace). Lists, subscribers, campaigns,
// templates and media belong to exactly one project.
type Project struct {
	Base

	UUID        string      `db:"uuid" json:"uuid"`
	Name        string      `db:"name" json:"name"`
	Slug        string      `db:"slug" json:"slug"`
	Domain      null.String `db:"domain" json:"domain"`
	Description string      `db:"description" json:"description"`

	ListCount     int `db:"list_count" json:"list_count"`
	CampaignCount int `db:"campaign_count" json:"campaign_count"`
}
