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
  password_login?: boolean;
  twofa_type?: 'none' | 'totp' | '';
}

export interface ServerConfig {
  root_url: string;
  // The root URL comes from the server's environment (Coolify) and can't be changed here.
  root_url_locked?: boolean;
  // permissions.json: [{ group, permissions }].
  permissions?: unknown;
  public_subscription?: { enabled: boolean; captcha_enabled: boolean; captcha_provider: string | null; captcha_key: string | null };
  // Base domain of the projects' subdomains, "" if none.
  projects_domain?: string;
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
  template_id?: number | null;
  archive?: boolean;
  archive_slug?: string | null;
  archive_template_id?: number | null;
  altbody?: string | null;
  headers?: Record<string, string>[];
}

export interface AnalyticsCount { campaign_id: number; count: number; timestamp: string }
export interface AnalyticsLink { url: string; count: number }

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
  hello_hostname: string;
  port: number;
  auth_protocol: 'none' | 'plain' | 'login' | 'cram';
  username: string;
  // Never sent back by the server: empty keeps the saved password.
  password?: string;
  email_headers: Record<string, string>[];
  max_conns: number;
  max_msg_retries: number;
  msg_retry_delay: string;
  idle_timeout: string;
  wait_timeout: string;
  tls_type: 'none' | 'STARTTLS' | 'TLS';
  tls_skip_verify: boolean;
  from_addresses: string[];
  exclude_from_default: boolean;
  project_id: number;
  cadence: RelayCadence;
  warmup: RelayWarmup;
  // Client only: added on this screen and not saved yet.
  _new?: boolean;
}

// The instance settings, as GET /api/settings returns them and PUT takes them
// back whole. Only the keys the screens use are typed.
export interface Settings {
  smtp: SmtpServer[];
  'app.site_name': string;
  'app.root_url': string;
  'app.logo_url': string;
  'app.favicon_url': string;
  'app.from_email': string[];
  'app.notify_emails': string[];
  'app.lang': string;
  'app.enable_public_subscription_page': boolean;
  'app.enable_public_archive': boolean;
  'app.send_optin_confirmation': boolean;
  'app.check_updates': boolean;
  'app.show_optin_page': boolean;
  'app.enable_public_archive_rss_content': boolean;
  'app.cache_slow_queries': boolean;
  'app.cache_slow_queries_interval': string;
  'privacy.exportable': string[];
  'privacy.domain_blocklist': string[];
  'privacy.domain_allowlist': string[];
  'maintenance.db': { vacuum: boolean; vacuum_cron_interval: string };
  'appearance.public.custom_css': string;
  'appearance.public.custom_js': string;
  'app.batch_size': number;
  'app.concurrency': number;
  'app.max_send_errors': number;
  'app.message_rate': number;
  'app.message_sliding_window': boolean;
  'app.message_sliding_window_duration': string;
  'app.message_sliding_window_rate': number;
  'privacy.individual_tracking': boolean;
  'privacy.disable_tracking': boolean;
  'privacy.unsubscribe_header': boolean;
  'privacy.allow_blocklist': boolean;
  'privacy.allow_preferences': boolean;
  'privacy.allow_export': boolean;
  'privacy.allow_wipe': boolean;
  'privacy.record_optin_ip': boolean;
  'security.captcha': { altcha: { enabled: boolean; complexity: number }; hcaptcha: { enabled: boolean; key: string; secret: string } };
  'security.oidc': {
    enabled: boolean; logout: boolean; verify_email: boolean; provider_url: string; provider_name: string;
    client_id: string; client_secret: string; auto_create_users: boolean;
    default_user_role_id: number | null; default_list_role_id: number | null;
    roles: { claim: string; match: string; user_role_id?: number; list_role_id?: number }[] | null;
  };
  'security.session_duration': string;
  'security.trusted_urls': string[];
  'upload.provider': 'filesystem' | 's3';
  'upload.extensions': string[];
  'upload.filesystem.upload_path': string;
  'upload.filesystem.upload_uri': string;
  'upload.s3.url': string;
  'upload.s3.public_url': string;
  'upload.s3.aws_access_key_id': string;
  'upload.s3.aws_secret_access_key': string;
  'upload.s3.aws_default_region': string;
  'upload.s3.bucket': string;
  'upload.s3.bucket_path': string;
  'upload.s3.bucket_type': string;
  'upload.s3.expiry': string;
  'bounce.enabled': boolean;
  'bounce.webhooks_enabled': boolean;
  'bounce.actions': Record<'soft' | 'hard' | 'complaint', { count: number; action: 'none' | 'unsubscribe' | 'blocklist' | 'delete' }>;
  'bounce.ses_enabled': boolean;
  'bounce.sendgrid_enabled': boolean;
  'bounce.sendgrid_key': string;
  'bounce.azure': { enabled: boolean; shared_secret: string; shared_secret_header: string };
  'bounce.postmark': { enabled: boolean; username: string; password: string };
  'bounce.forwardemail': { enabled: boolean; key: string };
  'bounce.lettermint': { enabled: boolean; key: string };
  'bounce.mailboxes': BounceBox[];
  messengers: Messenger[];
  [key: string]: unknown;
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

export interface RelayCadence {
  per_minute: number;
  per_hour: number;
  per_day: number;
  days: number[] | null;
  from_hour: number;
  to_hour: number;
  timezone: string;
}

export interface RelayWarmup {
  enabled: boolean;
  start: number;
  growth: number;
  cap: number;
  since: string;
}

export interface RelayStatus {
  name: string;
  day: string;
  sent_today: number;
  limit_today: number;
  warmup_day: number;
  warmup_done_day: number;
  open_now: boolean;
  next_send_at: string;
  has_cadence: boolean;
}

export interface Relay {
  uuid: string;
  name: string;
  host: string;
  port: number;
  enabled: boolean;
  pool: boolean;
  in_default_pool: boolean;
  project_id: number;
  system: boolean;
  cadence: RelayCadence;
  warmup: RelayWarmup;
  servers?: number;
  status: RelayStatus | null;
}

export interface RelayInput {
  project_id: number;
  cadence: RelayCadence;
  warmup: RelayWarmup;
  system: boolean;
}

export type TemplateType = 'campaign' | 'campaign_visual' | 'tx';

export interface Template {
  id: number;
  name: string;
  type: TemplateType;
  subject: string;
  body?: string;
  body_source?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateInput {
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
}

export interface ListInput {
  name: string;
  type: 'public' | 'private';
  optin: 'single' | 'double';
  status: 'active' | 'archived';
  tags: string[];
  description: string;
}

export interface SubscriberInput {
  email: string;
  name: string;
  status: 'enabled' | 'disabled' | 'blocklisted';
  lists: number[];
  attribs: Record<string, unknown>;
  preconfirm_subscriptions: boolean;
}

export interface ImportStatus {
  name: string;
  total: number;
  imported: number;
  status: 'none' | 'importing' | 'stopping' | 'finished' | 'failed';
}

export interface ImportParams {
  mode: 'subscribe' | 'blocklist';
  subscription_status: 'unconfirmed' | 'confirmed';
  overwrite: boolean;
  delim: string;
  lists: number[];
}

export interface Messenger {
  uuid?: string; enabled: boolean; name: string; root_url: string; username: string; password: string;
  max_conns: number; timeout: string; max_msg_retries: number;
}

export interface BounceBox {
  uuid?: string; enabled: boolean; type: 'pop'; host: string; port: number; auth_protocol: 'none' | 'userpass' | 'cram';
  return_path: string; username: string; password: string; tls_enabled: boolean; tls_skip_verify: boolean; scan_interval: string;
}

export interface Role { id: number; name: string; permissions: string[] }

export interface ListRole { id: number; name: string; lists: { id: number; name: string; permissions: string[] }[] }

export interface UserFull extends User {
  password_login: boolean;
  loggedin_at: string | null;
  created_at: string;
  list_role: { id: number; name: string } | null;
}

export interface UserInput {
  username: string;
  name: string;
  email: string;
  type: 'user' | 'api';
  status: 'enabled' | 'disabled';
  password_login: boolean;
  password: string;
  user_role_id: number;
  list_role_id: number | null;
}

export interface Media { id: number; uuid: string; filename: string; content_type: string; url: string; thumb_url: string; created_at: string; meta?: Record<string, unknown> }

export interface Bounce {
  id: number;
  type: 'soft' | 'hard' | 'complaint';
  source: string;
  email: string;
  subscriber_id: number;
  campaign: { id: number; name: string } | null;
  created_at: string;
}
