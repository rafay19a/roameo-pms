import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

type UserRole = 'admin' | 'manager' | 'staff';

interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAppUser(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchAppUser(session.user.id, session.user.email);
      } else {
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAppUser = async (userId: string, email?: string) => {
    try {
      const { data: appUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Record not found, create it
        const newUser = {
          id: userId,
          email: email || '',
          role: 'admin',
          is_active: true
        };
        const { data: createdUser, error: insertError } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single();
          
        if (insertError) {
          console.error(insertError);
          setAppUser(newUser as AppUser);
          return;
        }
        setAppUser(createdUser as AppUser);
      } else if (error) {
        console.error(error);
        setAppUser({
          id: userId,
          email: email || '',
          role: 'admin',
          is_active: true
        });
      } else {
        setAppUser(appUser as AppUser);
      }
    } catch (error: any) {
      console.error('Error fetching app user:', error);
      // Fallback if table doesn't exist or insert fails
      setAppUser({
        id: userId,
        email: email || '',
        role: 'admin',
        is_active: true
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
