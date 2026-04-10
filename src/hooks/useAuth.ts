import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, initAuth } from '../services/firebase';

/**
 * Hook for managing Firebase authentication state
 */
export const useAuth = (customToken?: string) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        await initAuth(customToken);
        onAuthChange((authUser) => {
          setUser(authUser);
          setLoading(false);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Auth error');
        setLoading(false);
      }
    };

    initializeAuth();
  }, [customToken]);

  return { user, loading, error };
};
