import { apiClient } from '@/shared/services/apiClient';
import type {
  SavedWithdrawalMethod,
  CreateSavedWithdrawalMethodRequest,
  UpdateSavedWithdrawalMethodRequest,
} from '../types';

/**
 * Service for managing saved withdrawal methods (bank accounts)
 */
class SavedWithdrawalMethodsService {
  private extractPayload<T>(response: any): T | null {
    if (!response?.success) return null;
    const raw = response.data;
    if (raw && typeof raw === 'object' && 'data' in raw) {
      return (raw as any).data as T;
    }
    return (raw as T) ?? null;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) {
      return null;
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all saved withdrawal methods for the current driver
   * GET /api/drivers/{driverId}/withdrawal-methods
   * @param driverId - Driver ID
   * @returns Promise resolving to array of saved withdrawal methods
   */
  async getAll(driverId: string): Promise<SavedWithdrawalMethod[]> {
    try {
      const response = await apiClient.get<SavedWithdrawalMethod[]>(
        `/api/drivers/${driverId}/withdrawal-methods`,
        { requiresAuth: true }
      );
      const methods = this.extractPayload<SavedWithdrawalMethod[]>(response);
      if (!methods || !Array.isArray(methods)) {
        return [];
      }
      return methods.map((m) => ({
        ...m,
        createdAt: this.parseDate((m as any).createdAt) || new Date(),
        updatedAt: this.parseDate((m as any).updatedAt) || new Date(),
        lastUsedAt: this.parseDate((m as any).lastUsedAt),
      }));
    } catch (error) {
      throw new Error(
        `Failed to fetch saved withdrawal methods: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a specific saved withdrawal method by ID
   * GET /api/drivers/{driverId}/withdrawal-methods/{id}
   * @param driverId - Driver ID
   * @param id - Withdrawal method ID
   * @returns Promise resolving to saved withdrawal method or null
   */
  async getById(driverId: string, id: string): Promise<SavedWithdrawalMethod | null> {
    try {
      const response = await apiClient.get<SavedWithdrawalMethod>(
        `/api/drivers/${driverId}/withdrawal-methods/${id}`,
        { requiresAuth: true }
      );
      const method = this.extractPayload<SavedWithdrawalMethod>(response);
      if (!method) {
        return null;
      }
      return {
        ...method,
        createdAt: this.parseDate((method as any).createdAt) || new Date(),
        updatedAt: this.parseDate((method as any).updatedAt) || new Date(),
        lastUsedAt: this.parseDate((method as any).lastUsedAt),
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch saved withdrawal method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a new saved withdrawal method
   * POST /api/drivers/{driverId}/withdrawal-methods
   * @param driverId - Driver ID
   * @param request - Withdrawal method creation data
   * @returns Promise resolving to created saved withdrawal method
   */
  async create(driverId: string, request: CreateSavedWithdrawalMethodRequest): Promise<SavedWithdrawalMethod> {
    try {
      const response = await apiClient.post<SavedWithdrawalMethod>(
        `/api/drivers/${driverId}/withdrawal-methods`,
        {
          body: request,
          requiresAuth: true,
        }
      );
      const method = this.extractPayload<SavedWithdrawalMethod>(response);
      if (!method) {
        const payload: any = response.data;
        throw new Error(payload?.message || response.message || 'Failed to create saved withdrawal method');
      }
      return {
        ...method,
        createdAt: this.parseDate((method as any).createdAt) || new Date(),
        updatedAt: this.parseDate((method as any).updatedAt) || new Date(),
        lastUsedAt: this.parseDate((method as any).lastUsedAt),
      };
    } catch (error) {
      throw new Error(
        `Failed to create saved withdrawal method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update a saved withdrawal method
   * PATCH /api/drivers/{driverId}/withdrawal-methods/{id}
   * @param driverId - Driver ID
   * @param id - Withdrawal method ID
   * @param request - Withdrawal method update data
   * @returns Promise resolving to updated saved withdrawal method
   */
  async update(
    driverId: string,
    id: string,
    request: UpdateSavedWithdrawalMethodRequest
  ): Promise<SavedWithdrawalMethod> {
    try {
      const response = await apiClient.patch<SavedWithdrawalMethod>(
        `/api/drivers/${driverId}/withdrawal-methods/${id}`,
        {
          body: request,
          requiresAuth: true,
        }
      );
      const method = this.extractPayload<SavedWithdrawalMethod>(response);
      if (!method) {
        const payload: any = response.data;
        throw new Error(payload?.message || response.message || 'Failed to update saved withdrawal method');
      }
      return {
        ...method,
        createdAt: this.parseDate((method as any).createdAt) || new Date(),
        updatedAt: this.parseDate((method as any).updatedAt) || new Date(),
        lastUsedAt: this.parseDate((method as any).lastUsedAt),
      };
    } catch (error) {
      throw new Error(
        `Failed to update saved withdrawal method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a saved withdrawal method
   * DELETE /api/drivers/{driverId}/withdrawal-methods/{id}
   * @param driverId - Driver ID
   * @param id - Withdrawal method ID
   * @returns Promise resolving when deletion is complete
   */
  async delete(driverId: string, id: string): Promise<void> {
    try {
      const response = await apiClient.delete(
        `/api/drivers/${driverId}/withdrawal-methods/${id}`,
        { requiresAuth: true }
      );
      const payload: any = response.data;
      if (!response.success || (payload && payload.success === false)) {
        throw new Error(payload?.message || response.message || 'Failed to delete saved withdrawal method');
      }
    } catch (error) {
      throw new Error(
        `Failed to delete saved withdrawal method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set a saved withdrawal method as default
   * POST /api/drivers/{driverId}/withdrawal-methods/{id}/set-default
   * @param driverId - Driver ID
   * @param id - Withdrawal method ID
   * @returns Promise resolving to updated saved withdrawal method
   */
  async setDefault(driverId: string, id: string): Promise<SavedWithdrawalMethod> {
    try {
      const response = await apiClient.post<SavedWithdrawalMethod>(
        `/api/drivers/${driverId}/withdrawal-methods/${id}/set-default`,
        {
          requiresAuth: true,
        }
      );
      const method = this.extractPayload<SavedWithdrawalMethod>(response);
      if (!method) {
        const payload: any = response.data;
        throw new Error(payload?.message || response.message || 'Failed to set default withdrawal method');
      }
      return {
        ...method,
        createdAt: this.parseDate((method as any).createdAt) || new Date(),
        updatedAt: this.parseDate((method as any).updatedAt) || new Date(),
        lastUsedAt: this.parseDate((method as any).lastUsedAt),
      };
    } catch (error) {
      throw new Error(
        `Failed to set default withdrawal method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const savedWithdrawalMethodsService = new SavedWithdrawalMethodsService();
