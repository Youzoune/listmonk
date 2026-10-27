import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from './client';
import type {
  Campaign, CampaignStatus, DashboardCharts, DashboardCounts, List, NewCampaign, Page, Profile, Project,
  ServerConfig, Settings, Subscriber,
} from './types';

// Query keys start with the project so that switching project refetches everything.
const key = (project: number | null, ...rest: unknown[]) => ['p', project, ...rest];

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/api/profile'), staleTime: 5 * 60_000 });
}

export function useProjects(enabled: boolean) {
  return useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/api/projects'), enabled, staleTime: 60_000 });
}

export function useServerConfig() {
  return useQuery({ queryKey: ['config'], queryFn: () => api<ServerConfig>('/api/config'), staleTime: 5 * 60_000 });
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
