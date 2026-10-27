import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Link, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import { ApiError } from './api/client';
import { Shell } from './components/Shell';
import { ProjectProvider } from './project';
import { Audience } from './views/Audience';
import { Brand } from './views/Brand';
import { Campaigns } from './views/Campaigns';
import { Guide } from './views/Guide';
import { Home } from './views/Home';
import { NewCampaign } from './views/NewCampaign';
import { ProjectEdit } from './views/ProjectEdit';
import { Projects } from './views/Projects';
import { Relays } from './views/Relays';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Don't retry what retrying can't fix (permissions, missing records, bad input).
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

function NotFound() {
  return (
    <div className="view">
      <h1>Page introuvable</h1>
      <p className="muted">Cette adresse ne correspond à aucun écran de Relais.</p>
      <Link className="link" to="/">Revenir à Aujourd’hui</Link>
    </div>
  );
}

const router = createBrowserRouter(
  [
    {
      element: <ProjectProvider><Shell /></ProjectProvider>,
      children: [
        { index: true, element: <Home /> },
        { path: 'campagnes', element: <Campaigns /> },
        { path: 'campagnes/nouvelle', element: <NewCampaign /> },
        { path: 'audience', element: <Audience /> },
        { path: 'relais', element: <Relays /> },
        { path: 'projets', element: <Projects /> },
        { path: 'projets/nouveau', element: <ProjectEdit /> },
        { path: 'projets/:id', element: <ProjectEdit /> },
        { path: 'guide', element: <Guide /> },
        { path: 'marque', element: <Brand /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: '/app' },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
