// Shapes returned by the listmonk JSON API (only the fields the app uses).

export type CampaignStatus = 'draft' | 'running' | 'scheduled' | 'paused' | 'cancelled' | 'finished';

export interface Page<T> {
  results: T[];
  total: number;
  per_page: number;
  page: number;
}

export interface Project {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  domain: string | null;
  description: string;
  list_count: number;
  campaign_count: number;
}

export interface Profile {
  id: number;
  username: string;
  name: string;
  email: string | null;
  type: 'user' | 'api';
  user_role: { id: number; name: string; permissions: string[] };
}

export interface ServerConfig {
  root_url: string;
  from_email: string;
  from_emails: string[];
  messengers: string[];
}

export interface Campaign {
  id: number;
  uuid: string;
  name: string;
  subject: string;
  from_email: string;
  status: CampaignStatus;
  content_type: string;
  body: string;
  messenger: string;
  tags: string[];
  lists: { id: number; name: string }[];
  to_send: number;
  sent: number;
  views: number;
  clicks: number;
  bounces: number;
  send_at: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface List {
  id: number;
  uuid: string;
  name: string;
  type: 'public' | 'private' | 'temporary';
  optin: 'single' | 'double';
  status: 'active' | 'archived';
  tags: string[];
  description: string;
  subscriber_count: number;
  subscriber_statuses: Record<string, number>;
}

export interface Subscriber {
  id: number;
  uuid: string;
  email: string;
  name: string;
  status: 'enabled' | 'disabled' | 'blocklisted';
  attribs: Record<string, unknown>;
  lists: { id: number; name: string; subscription_status: 'unconfirmed' | 'confirmed' | 'unsubscribed' }[];
  created_at: string;
  updated_at: string;
}

export interface DashboardCounts {
  subscribers: { total: number; blocklisted: number; orphans: number };
  lists: { total: number; private: number; public: number };
  campaigns: { total: number; by_status: Partial<Record<CampaignStatus, number>> };
  messages: number;
}

export interface DashboardCharts {
  campaign_views: { date: string; count: number }[] | null;
  link_clicks: { date: string; count: number }[] | null;
}

export interface SmtpServer {
  uuid: string;
  name: string;
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  max_conns: number;
  tls_type: string;
  exclude_from_default: boolean;
  from_addresses: string[];
}

export interface Settings {
  smtp: SmtpServer[];
  'app.concurrency': number;
  'app.message_rate': number;
  'app.message_sliding_window': boolean;
  'app.message_sliding_window_duration': string;
  'app.message_sliding_window_rate': number;
}

export interface NewCampaign {
  name: string;
  subject: string;
  from_email: string;
  lists: number[];
  messenger: string;
  content_type: 'plain' | 'richtext' | 'html' | 'markdown';
  body: string;
  tags: string[];
  send_at?: string | null;
}

export interface User {
  id: number;
  username: string;
  name: string;
  email: string | null;
  type: 'user' | 'api';
  status: 'enabled' | 'disabled';
  user_role: { id: number; name: string; permissions: string[] };
}

export interface ProjectInput {
  name: string;
  slug: string;
  domain: string | null;
  description: string;
}
