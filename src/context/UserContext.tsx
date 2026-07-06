'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import logger from '@/lib/logger'

export interface UserPermissions {
  viewMarketingDashboard: boolean;
  viewMarketingLeads: boolean;
  viewMarketingOportunidades: boolean;
  viewMarketingEstoque: boolean;
  viewMarketingAds: boolean;
  viewMarketingVendas: boolean;
  viewProjectVision: boolean;
  manageProjects: boolean;
  manageCommentsDocs: boolean;
  deleteTasks: boolean;
  viewPeopleVision: boolean;
  viewQualityVision: boolean;
  isAdmin: boolean;
}

export interface User {
  id: string;
  name: string;
  role: 'Desenvolvedor' | 'Diretoria' | 'Operador' | 'Gestor' | 'Parceiro' | 'Corretor' | 'Visualizador';
  email: string;
  permissions?: UserPermissions;
}

interface UserContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  availableUsers: User[];
  isLoading: boolean;
}

const defaultUser: User = {
  id: '',
  name: 'Carregando...',
  role: 'Parceiro',
  email: '',
  permissions: {
    viewMarketingDashboard: false,
    viewMarketingLeads: false,
    viewMarketingOportunidades: false,
    viewMarketingEstoque: false,
    viewMarketingAds: false,
    viewMarketingVendas: false,
    viewProjectVision: false,
    manageProjects: false,
    manageCommentsDocs: false,
    deleteTasks: false,
    viewPeopleVision: false,
    viewQualityVision: false,
    isAdmin: false
  }
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User>(defaultUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUserState(data.user);
          }
        }
      } catch (e) {
        logger.error({ e }, 'Erro ao carregar usuário autenticado:');
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const setCurrentUser = (user: User) => {
    setCurrentUserState(user);
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, availableUsers: [currentUser], isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser deve ser usado dentro de um UserProvider');
  }
  return context;
}
