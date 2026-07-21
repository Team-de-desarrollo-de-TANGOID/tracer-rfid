import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PermissionCatalogProvider } from './context/PermissionCatalogContext';
import App from './App';
import './index.css';

const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <AuthProvider>
        <PermissionCatalogProvider>
          <App />
        </PermissionCatalogProvider>
      </AuthProvider>
    ),
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
