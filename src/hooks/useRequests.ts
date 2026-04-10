import { useEffect, useState } from 'react';
import { Request } from '../types';
import { subscribeToRequests, addRequest as firebaseAddRequest, deleteRequest as firebaseDeleteRequest } from '../services/firebase';
import { FormData } from '../types';

/**
 * Hook for managing requests list and operations
 */
export const useRequests = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time updates
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToRequests((newRequests) => {
      setRequests(newRequests);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const addRequest = async (formData: FormData): Promise<boolean> => {
    try {
      setLoading(true);
      const docId = await firebaseAddRequest(formData);
      setError(null);
      return !!docId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error adding request';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteRequest = async (docId: string): Promise<boolean> => {
    try {
      setLoading(true);
      const success = await firebaseDeleteRequest(docId);
      setError(null);
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error deleting request';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    requests,
    loading,
    error,
    addRequest,
    deleteRequest,
  };
};
