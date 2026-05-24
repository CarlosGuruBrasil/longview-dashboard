'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  name: string;
  role: 'Diretoria' | 'Equipe Interna' | 'Parceiro';
  email: string;
}

interface UserContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  availableUsers: User[];
}

const availableUsers: User[] = [
  { id: 'usr-1', name: 'Carlos Santos', role: 'Diretoria', email: 'carlos.diretoria@longview.com.br' },
  { id: 'usr-2', name: 'Michele Lima', role: 'Equipe Interna', email: 'michele@longview.com.br' },
  { id: 'usr-3', name: 'Carol Silva', role: 'Equipe Interna', email: 'carol@longview.com.br' },
  { id: 'usr-4', name: 'Margarete Pereira', role: 'Equipe Interna', email: 'margarete@longview.com.br' },
  { id: 'usr-5', name: 'Guto - LV', role: 'Equipe Interna', email: 'guto@longview.com.br' },
  { id: 'usr-6', name: 'Portal Engenharia', role: 'Parceiro', email: 'contato@portaleng.com.br' }
];

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User>(availableUsers[0]);

  useEffect(() => {
    const savedUser = localStorage.getItem('lvm_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        const match = availableUsers.find(u => u.id === parsed.id);
        if (match) {
          Promise.resolve().then(() => {
            setCurrentUserState(match);
          });
        }
      } catch (e) {
        console.error('Erro ao ler usuário salvo:', e);
      }
    }
  }, []);

  const setCurrentUser = (user: User) => {
    setCurrentUserState(user);
    localStorage.setItem('lvm_current_user', JSON.stringify(user));
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, availableUsers }}>
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
