import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from './client';
import type {
  Campaign, CampaignStatus, DashboardCharts, DashboardCounts, List, NewCampaign, Page, Profile, Project,
  ProjectInput, Relay, RelayInput, ServerConfig, Settings, Subscriber, User,
} from './types';

// Query keys start with the project so that switching project refetches everything.
const key = (project: number | null, ...rest: unknown[]) => ['p', project, ...rest];

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/api/profile'), staleTime: 5 * 60_000 });
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

export function useSubscribers(project: number | null, opts: { search?: string; status?: string; listId?: number; page?: number; perPage?: number }) {
  const q = query({
    search: opts.search,
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
