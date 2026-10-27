import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, query } from './client';
import type {
  Campaign, CampaignStatus, DashboardCharts, DashboardCounts, List, NewCampaign, Page, Profile, Project,
  AnalyticsCount, AnalyticsLink, Bounce, ListRole, Media, Role, UserFull, UserInput, ImportParams, ImportStatus, ListInput, ProjectInput, Relay, RelayInput, ServerConfig, Settings, SmtpServer, Subscriber, SubscriberInput, Template, TemplateInput, User,
} from './types';

// Query keys start with the project so that switching project refetches everything.
const key = (project: number | null, ...rest: unknown[]) => ['p', project, ...rest];

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/api/profile'), staleTime: 5 * 60_000 });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { name: string; email: string; password?: string }) => api<Profile>('/api/profile', { method: 'PUT', json: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

// TOTP two-factor authentication of the signed-in user.
export function useTotpSetup(userId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['totp', userId],
    queryFn: () => api<{ secret: string; qr: string }>(`/api/users/${userId}/twofa/totp`),
    enabled: enabled && !!userId,
    staleTime: Infinity,
  });
}

export function useTotp(userId: number | undefined) {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['profile'] }); qc.removeQueries({ queryKey: ['totp'] }); };
  const enable = useMutation({
    mutationFn: (b: { secret: string; code: string }) => api<boolean>(`/api/users/${userId}/twofa`, { method: 'PUT', json: b }),
    onSuccess: done,
  });
  const disable = useMutation({
    mutationFn: (password: string) => api<boolean>(`/api/users/${userId}/twofa`, { method: 'DELETE', json: { password } }),
    onSuccess: done,
  });
  return { enable, disable };
}

export async function logout() {
  let next = '/admin/login';
  try {
    const r = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    const b = await r.json() as { redirect_url?: string | null };
    if (b.redirect_url) next = b.redirect_url;
  } catch { /* the session is gone or the server is down: the login page says which */ }
  window.location.assign(next);
}

export function useProjects(enabled: boolean) {
  return useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/api/projects'), enabled, staleTime: 60_000 });
}

// The config lists the relays the current project may use: it's per project.
export function useServerConfig(project: number | null) {
  return useQuery({ queryKey: key(project, 'config'), queryFn: () => api<ServerConfig>('/api/config'), staleTime: 5 * 60_000 });
}

export function useDashboard(project: number | null) {
  const counts = useQuery({ queryKey: key(project, 'dash-counts'), queryFn: () => api<DashboardCounts>('/api/dashboard/counts') });
  const charts = useQuery({ queryKey: key(project, 'dash-charts'), queryFn: () => api<DashboardCharts>('/api/dashboard/charts') });
  return { counts, charts };
}

export function useCampaigns(project: number | null, opts: { status?: CampaignStatus[]; search?: string; page?: number; perPage?: number }) {
  const q = query({
    status: opts.status,
    query: opts.search,
    page: opts.page ?? 1,
    per_page: opts.perPage ?? 20,
    order_by: 'created_at',
    order: 'desc',
    no_body: true,
  });
  return useQuery({ queryKey: key(project, 'campaigns', q), queryFn: () => api<Page<Campaign>>(`/api/campaigns${q}`), placeholderData: (prev) => prev });
}

export function useLists(project: number | null) {
  return useQuery({
    queryKey: key(project, 'lists'),
    queryFn: () => api<Page<List>>(`/api/lists${query({ per_page: 'all', order_by: 'name', order: 'asc' })}`),
  });
}

export function useSubscribers(project: number | null, opts: { search?: string; sql?: string; status?: string; listId?: number; page?: number; perPage?: number }) {
  const q = query({
    search: opts.search,
    query: opts.sql,
    status: opts.status,
    list_id: opts.listId,
    page: opts.page ?? 1,
    per_page: opts.perPage ?? 25,
    order_by: 'updated_at',
    order: 'desc',
  });
  return useQuery({ queryKey: key(project, 'subscribers', q), queryFn: () => api<Page<Subscriber>>(`/api/subscribers${q}`), placeholderData: (prev) => prev });
}

export function useSettings(enabled: boolean) {
  return useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/api/settings'), enabled });
}

// Waits for the server to answer again after it reloaded its settings.
export async function waitForReload(timeoutMs = 20_000) {
  await new Promise((r) => setTimeout(r, 800));
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch('/api/health', { credentials: 'same-origin' });
      if (res.ok) return;
    } catch { /* restarting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
}

// Saves the whole settings object. The server reloads to apply it, unless
// campaigns are sending (needs_restart).
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Settings) => {
      const out = await api<true | { needs_restart: boolean }>('/api/settings', { method: 'PUT', json: settings });
      await waitForReload();
      return out;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

// Sends a test e-mail through an SMTP server, saved or not.
export function useTestSmtp() {
  return useMutation({
    mutationFn: ({ server, email }: { server: SmtpServer; email: string }) =>
      api<string[]>('/api/settings/smtp/test', { method: 'POST', json: { ...server, email } }),
  });
}

export function useCreateCampaign(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaign, start }: { campaign: NewCampaign; start: 'draft' | 'now' | 'scheduled' }) => {
      const created = await api<Campaign>('/api/campaigns', { method: 'POST', json: campaign });
      if (start !== 'draft') {
        return api<Campaign>(`/api/campaigns/${created.id}/status`, {
          method: 'PUT',
          json: { status: start === 'now' ? 'running' : 'scheduled' },
        });
      }
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

// Creates a project (no id) or updates one.
export function useSaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, project }: { id?: number; project: ProjectInput }) =>
      id ? api<Project>(`/api/projects/${id}`, { method: 'PUT', json: project }) : api<Project>('/api/projects', { method: 'POST', json: project }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<boolean>(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUsers(enabled: boolean) {
  return useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/api/users'), enabled });
}

// The project IDs each given user has access to, keyed by user ID.
export function useUsersProjects(userIds: number[], enabled: boolean) {
  return useQuery({
    queryKey: ['users-projects', userIds],
    enabled: enabled && userIds.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(userIds.map(async (id) => [id, await api<number[]>(`/api/users/${id}/projects`)] as const));
      return Object.fromEntries(pairs) as Record<number, number[]>;
    },
  });
}

// Updates a user's projects, showing the change right away and rolling it
// back if the server refuses it.
export function useSetUserProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, projectIds }: { userId: number; projectIds: number[] }) =>
      api<number[]>(`/api/users/${userId}/projects`, { method: 'PUT', json: { project_ids: projectIds } }),
    onMutate: async ({ userId, projectIds }) => {
      await qc.cancelQueries({ queryKey: ['users-projects'] });
      const previous = qc.getQueriesData<Record<number, number[]>>({ queryKey: ['users-projects'] });
      qc.setQueriesData<Record<number, number[]>>({ queryKey: ['users-projects'] }, (old) => (old ? { ...old, [userId]: projectIds } : old));
      return { previous };
    },
    onError: (_err, _vars, ctx) => ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['users-projects'] }),
  });
}

export function useRelays(project: number | null, enabled = true) {
  return useQuery({ queryKey: key(project, 'relays'), queryFn: () => api<Relay[]>('/api/relays'), enabled, refetchInterval: 30_000 });
}

// Saves a relay's project, cadence and warm-up. The server reloads to apply
// them, unless campaigns are running (needs_restart).
export function useSaveRelay(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, relay }: { uuid: string; relay: RelayInput }) =>
      api<true | { needs_restart: boolean }>(`/api/relays/${uuid}`, { method: 'PUT', json: relay }),
    // Give the server a moment to reload before reading the relays again.
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: key(project, 'relays') }), 1500),
  });
}

export function useTemplates(project: number | null) {
  return useQuery({ queryKey: key(project, 'templates'), queryFn: () => api<Template[]>('/api/templates?no_body=true') });
}

export function useTemplate(project: number | null, id: number | null) {
  return useQuery({ queryKey: key(project, 'template', id), queryFn: () => api<Template>(`/api/templates/${id}`), enabled: !!id });
}

export function useSaveTemplate(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tpl }: { id?: number; tpl: TemplateInput }) =>
      id ? api<Template>(`/api/templates/${id}`, { method: 'PUT', json: tpl }) : api<Template>('/api/templates', { method: 'POST', json: tpl }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

export function useTemplateAction(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'default' | 'delete' }) =>
      action === 'delete' ? api<boolean>(`/api/templates/${id}`, { method: 'DELETE' }) : api<unknown>(`/api/templates/${id}/default`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

export function useSaveList(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, list }: { id?: number; list: ListInput }) =>
      id ? api<List>(`/api/lists/${id}`, { method: 'PUT', json: list }) : api<List>('/api/lists', { method: 'POST', json: list }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

export function useDeleteList(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<boolean>(`/api/lists/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

export function useSubscriber(project: number | null, id: number | null) {
  return useQuery({ queryKey: key(project, 'subscriber', id), queryFn: () => api<Subscriber>(`/api/subscribers/${id}`), enabled: !!id });
}

export function useSaveSubscriber(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sub }: { id?: number; sub: SubscriberInput }) =>
      id ? api<Subscriber>(`/api/subscribers/${id}`, { method: 'PUT', json: sub }) : api<Subscriber>('/api/subscribers', { method: 'POST', json: sub }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

export function useDeleteSubscriber(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<boolean>(`/api/subscribers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

// The importer is one per instance: its status is polled while it runs.
export function useImportStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['import-status'],
    queryFn: () => api<ImportStatus>('/api/import/subscribers'),
    enabled,
    refetchInterval: (q) => (q.state.data?.status === 'importing' || q.state.data?.status === 'stopping' ? 1000 : false),
  });
}

export function useImportLogs(enabled: boolean) {
  return useQuery({ queryKey: ['import-logs'], queryFn: () => api<string>('/api/import/subscribers/logs'), enabled, refetchInterval: enabled ? 2000 : false });
}

export function useStartImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, params }: { file: File; params: ImportParams }) => {
      const form = new FormData();
      form.set('params', JSON.stringify(params));
      form.set('file', file);
      // FormData needs the browser to set the multipart boundary itself.
      return api<ImportStatus>('/api/import/subscribers', { method: 'POST', body: form });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['import-status'] }),
  });
}

export function useStopImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ImportStatus>('/api/import/subscribers', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export const isNotFound = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 400);

export function useCampaign(project: number | null, id: number | null) {
  return useQuery({
    queryKey: key(project, 'campaign', id),
    queryFn: () => api<Campaign>(`/api/campaigns/${id}`),
    enabled: !!id,
    // A running campaign's counters move.
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 5000 : false),
  });
}

// PUT takes the whole campaign: send it back with the changes.
export function useSaveCampaign(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, campaign }: { id: number; campaign: Record<string, unknown> }) =>
      api<Campaign>(`/api/campaigns/${id}`, { method: 'PUT', json: campaign }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

export function useCampaignStatus(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: CampaignStatus }) =>
      api<Campaign>(`/api/campaigns/${id}/status`, { method: 'PUT', json: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

export function useDeleteCampaign(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<boolean>(`/api/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

export function useCloneCampaign(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Campaign) => api<Campaign>('/api/campaigns', {
      method: 'POST',
      json: {
        name: `Copie de ${c.name}`, subject: c.subject, from_email: c.from_email, lists: c.lists.map((l) => l.id),
        messenger: c.messenger, content_type: c.content_type, body: c.body, tags: c.tags, template_id: c.template_id ?? undefined,
      },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}

// Sends the campaign, as currently edited, to contacts of the project.
export function useTestCampaign() {
  return useMutation({
    mutationFn: ({ id, campaign, emails }: { id: number; campaign: Record<string, unknown>; emails: string[] }) =>
      api<boolean>(`/api/campaigns/${id}/test`, { method: 'POST', json: { ...campaign, subscribers: emails } }),
  });
}

export function useCampaignAnalytics(project: number | null, id: number | null, range: { from: string; to: string } | null) {
  const q = (type: string) => `/api/campaigns/analytics/${type}${query({ id: id ?? 0, from: range?.from, to: range?.to })}`;
  const enabled = !!id && !!range;
  const views = useQuery({ queryKey: key(project, 'camp-views', id, range), queryFn: () => api<AnalyticsCount[]>(q('views')), enabled });
  const clicks = useQuery({ queryKey: key(project, 'camp-clicks', id, range), queryFn: () => api<AnalyticsCount[]>(q('clicks')), enabled });
  const links = useQuery({ queryKey: key(project, 'camp-links', id, range), queryFn: () => api<AnalyticsLink[]>(q('links')), enabled });
  return { views, clicks, links };
}

export function useUsersFull(enabled: boolean) {
  return useQuery({ queryKey: ['users-full'], queryFn: () => api<UserFull[]>('/api/users'), enabled });
}

export function useRoles(enabled: boolean) {
  const users = useQuery({ queryKey: ['roles', 'users'], queryFn: () => api<Role[]>('/api/roles/users'), enabled });
  const lists = useQuery({ queryKey: ['roles', 'lists'], queryFn: () => api<ListRole[]>('/api/roles/lists'), enabled });
  return { users, lists };
}

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, user }: { id?: number; user: UserInput }) =>
      id ? api<UserFull & { password?: string }>(`/api/users/${id}`, { method: 'PUT', json: user })
        : api<UserFull & { password?: string }>('/api/users', { method: 'POST', json: user }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users-full'] }); qc.invalidateQueries({ queryKey: ['users'] }); },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<boolean>(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users-full'] }); qc.invalidateQueries({ queryKey: ['users'] }); },
  });
}

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id?: number; role: { name: string; permissions: string[] } }) =>
      id ? api<Role>(`/api/roles/users/${id}`, { method: 'PUT', json: role }) : api<Role>('/api/roles/users', { method: 'POST', json: role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useSaveListRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id?: number; role: { name: string; lists: { id: number; permissions: string[] }[] } }) =>
      id ? api<ListRole>(`/api/roles/lists/${id}`, { method: 'PUT', json: role }) : api<ListRole>('/api/roles/lists', { method: 'POST', json: role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); qc.invalidateQueries({ queryKey: ['users-full'] }); },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<boolean>(`/api/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useMedia(project: number | null, enabled = true) {
  return useQuery({ queryKey: key(project, 'media'), queryFn: () => api<Page<Media>>('/api/media?per_page=all'), enabled });
}

export function useUploadMedia(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.set('file', file);
      return api<Media>('/api/media', { method: 'POST', body: form });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project, 'media') }),
  });
}

export function useDeleteMedia(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<boolean>(`/api/media/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project, 'media') }),
  });
}

export function useBounces(project: number | null, page: number) {
  return useQuery({
    queryKey: key(project, 'bounces', page),
    queryFn: () => api<Page<Bounce>>(`/api/bounces${query({ page, per_page: 30, order_by: 'created_at', order: 'desc' })}`),
    placeholderData: (prev) => prev,
  });
}

export function useBounceAction(project: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: 'delete' | 'blocklist' }) => action === 'delete'
      ? api<boolean>(`/api/bounces${query({ id: ids })}`, { method: 'DELETE' })
      : api<boolean>(`/api/bounces/blocklist${query({ id: ids })}`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(project) }),
  });
}
