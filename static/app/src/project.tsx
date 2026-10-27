// Current project and user. Every API call is scoped to the project picked here.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setCurrentProject } from './api/client';
import { useProfile, useProjects } from './api/hooks';
import type { Profile, Project } from './api/types';

const STORAGE_KEY = 'relais.project';
const SUPER_ADMIN_ROLE = 1;

export function hasPerm(profile: Profile | undefined, ...perms: string[]) {
  if (!profile) return false;
  if (profile.user_role.id === SUPER_ADMIN_ROLE) return true;
  return perms.some((p) => profile.user_role.permissions.includes(p));
}

// Used when the user can't list projects: everything lives in the default project.
const DEFAULT_PROJECT: Project = {
  id: 1, uuid: '', name: 'Projet par défaut', slug: 'default', domain: null, description: '', list_count: 0, campaign_count: 0,
};

interface Ctx {
  profile: Profile | undefined;
  projects: Project[];
  project: Project;
  setProject: (id: number) => void;
  can: (...perms: string[]) => boolean;
}

const ProjectContext = createContext<Ctx | null>(null);

function readStored(): number | null {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const canList = hasPerm(profile, 'projects:get', 'projects:manage');
  const { data } = useProjects(canList);
  const projects = useMemo(() => (canList && data?.length ? data : [DEFAULT_PROJECT]), [canList, data]);
  const [selected, setSelected] = useState<number | null>(readStored);

  const project = projects.find((p) => p.id === selected) ?? projects[0];
  setCurrentProject(project.id);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(project.id));
    } catch {
      /* storage unavailable: the choice lasts for this tab only */
    }
  }, [project.id]);

  const value = useMemo<Ctx>(() => ({
    profile,
    projects,
    project,
    setProject: (id) => {
      setCurrentProject(id);
      setSelected(id);
      qc.invalidateQueries({ queryKey: ['p'] });
    },
    can: (...perms) => hasPerm(profile, ...perms),
  }), [profile, projects, project, qc]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject outside ProjectProvider');
  return ctx;
}
