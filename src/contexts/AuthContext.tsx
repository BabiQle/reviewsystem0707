import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { pb } from '@/db/pb';
import type { Profile } from '@/types/types';

export interface PBUser {
  id: string;
  email: string;
}

export function getProfile(userId: string): Promise<Profile | null> {
  const model = pb.authStore.model as any;
  if (model && model.id === userId) {
    return Promise.resolve({
      id: model.id,
      username: model.username ?? '',
      display_name: model.display_name || model.username || model.email || '',
      role: (model.role as Profile['role']) ?? 'reviewee_only',
      created_at: model.created ?? '',
    });
  }
  return Promise.resolve(null);
}


interface AuthContextType {
  user: PBUser | null;
  profile: Profile | null;
  loading: boolean;
  signInWithUsername: (identity: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PBUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = () => {
    const model = pb.authStore.model as any;
    if (model && model.id) {
      setUser({ id: model.id, email: model.email ?? '' });
      setProfile({
        id: model.id,
        username: model.username ?? '',
        display_name: model.display_name || model.username || model.email || '',
        role: (model.role as Profile['role']) ?? 'reviewee_only',
        created_at: model.created ?? '',
      });
    } else {
      // 未登录，清除用户状态
      setUser(null);
      setProfile(null);
    }
    return Promise.resolve();
  };

  useEffect(() => {
    const initAuth = () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        const model = pb.authStore.model as any;
        setUser({ id: model.id, email: model.email ?? '' });
        setProfile({
          id: model.id,
          username: model.username ?? '',
          display_name: model.display_name || model.username || model.email || '',
          role: (model.role as Profile['role']) ?? 'reviewee_only',
          created_at: model.created ?? '',
        });
      } else {
        // 未登录，不创建匿名用户
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    };

    initAuth();

    const unsubscribe = pb.authStore.onChange(() => {
      refreshProfile();
    });

    return () => unsubscribe();
  }, []);

  const signInWithUsername = async (identity: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(identity, password);
      const model = authData.record as any;
      setUser({ id: model.id, email: model.email ?? '' });
      setProfile({
        id: model.id,
        username: model.username ?? '',
        display_name: model.display_name || model.username || model.email || '',
        role: (model.role as Profile['role']) ?? 'reviewee_only',
        created_at: model.created ?? '',
      });
      return { error: null };
    } catch (err) {
      console.error('PocketBase 登录失败:', err);
      return { error: err as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string) => {
    try {
      await pb.collection('users').create({
        username,
        password,
        passwordConfirm: password,
      });
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    pb.authStore.clear();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithUsername, signUpWithUsername, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
