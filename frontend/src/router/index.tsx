// src/router/index.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import SettingsPage from '@/pages/SettingsPage';
import AppLayout from '@/layouts/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Conversation state lives in the URL so refreshes/tabs restore it.
          { path: '/c', element: <HomePage /> },
          { path: '/c/:conversationId', element: <HomePage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/c" replace /> },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
