import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { savedWithdrawalMethodsService } from '../services/savedWithdrawalMethodsService';
import type {
  SavedWithdrawalMethod,
  CreateSavedWithdrawalMethodRequest,
  UpdateSavedWithdrawalMethodRequest,
} from '../types';

interface UseSavedWithdrawalMethodsReturn {
  methods: SavedWithdrawalMethod[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (request: CreateSavedWithdrawalMethodRequest) => Promise<SavedWithdrawalMethod>;
  update: (id: string, request: UpdateSavedWithdrawalMethodRequest) => Promise<SavedWithdrawalMethod>;
  delete: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<SavedWithdrawalMethod>;
}

/**
 * Hook for managing saved withdrawal methods (bank accounts)
 * Provides CRUD operations and state management
 */
export function useSavedWithdrawalMethods(): UseSavedWithdrawalMethodsReturn {
  const { user } = useAuth();
  const [methods, setMethods] = useState<SavedWithdrawalMethod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      setMethods([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await savedWithdrawalMethodsService.getAll(user.id);
      setMethods(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch saved withdrawal methods';
      setError(errorMessage);
      console.error('[useSavedWithdrawalMethods] Error fetching methods:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const create = useCallback(async (
    request: CreateSavedWithdrawalMethodRequest
  ): Promise<SavedWithdrawalMethod> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    try {
      const newMethod = await savedWithdrawalMethodsService.create(user.id, request);
      await fetchMethods(); // Refresh list
      return newMethod;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create saved withdrawal method';
      console.error('[useSavedWithdrawalMethods] Error creating method:', err);
      throw new Error(errorMessage);
    }
  }, [user?.id, fetchMethods]);

  const update = useCallback(async (
    id: string,
    request: UpdateSavedWithdrawalMethodRequest
  ): Promise<SavedWithdrawalMethod> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    try {
      const updatedMethod = await savedWithdrawalMethodsService.update(user.id, id, request);
      await fetchMethods(); // Refresh list
      return updatedMethod;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update saved withdrawal method';
      console.error('[useSavedWithdrawalMethods] Error updating method:', err);
      throw new Error(errorMessage);
    }
  }, [user?.id, fetchMethods]);

  const deleteMethod = useCallback(async (id: string): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    try {
      await savedWithdrawalMethodsService.delete(user.id, id);
      await fetchMethods(); // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete saved withdrawal method';
      console.error('[useSavedWithdrawalMethods] Error deleting method:', err);
      throw new Error(errorMessage);
    }
  }, [user?.id, fetchMethods]);

  const setDefault = useCallback(async (id: string): Promise<SavedWithdrawalMethod> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    try {
      const updatedMethod = await savedWithdrawalMethodsService.setDefault(user.id, id);
      await fetchMethods(); // Refresh list
      return updatedMethod;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default withdrawal method';
      console.error('[useSavedWithdrawalMethods] Error setting default:', err);
      throw new Error(errorMessage);
    }
  }, [user?.id, fetchMethods]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  return {
    methods,
    isLoading,
    error,
    refresh: fetchMethods,
    create,
    update,
    delete: deleteMethod,
    setDefault,
  };
}
