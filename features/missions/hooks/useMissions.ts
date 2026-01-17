import { useCallback, useEffect, useState } from 'react';
import { missionService } from '../services/missionService';
import type { DriverMission, MissionStatus } from '../types';

interface UseMissionsReturn {
  missions: DriverMission[];
  isLoading: boolean;
  error: string | null;
  filter: MissionStatus | 'All';
  setFilter: (filter: MissionStatus | 'All') => void;
  refresh: () => Promise<void>;
  claimMission: (missionId: string) => Promise<void>;
  activeMissions: DriverMission[];
  availableMissions: DriverMission[];
  completedMissions: DriverMission[];
}

export function useMissions(driverId: string): UseMissionsReturn {
  const [missions, setMissions] = useState<DriverMission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MissionStatus | 'All'>('All');

  const fetchMissions = useCallback(async () => {
    if (!driverId) return;

    setIsLoading(true);
    setError(null);

    try {
      const allMissions: DriverMission[] = [];
      
      // Fetch all statuses
      const [active, available, completed] = await Promise.all([
        missionService.getMissions(driverId, 'Active'),
        missionService.getMissions(driverId, 'Available'),
        missionService.getMissions(driverId, 'Completed'),
      ]);

      allMissions.push(...active, ...available, ...completed);
      setMissions(allMissions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch missions';
      setError(errorMessage);
      console.error('Error fetching missions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  const claimMission = useCallback(
    async (missionId: string) => {
      if (!driverId) return;

      try {
        await missionService.claimMission(driverId, missionId);
        // Refresh missions after claiming
        await fetchMissions();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to claim mission';
        setError(errorMessage);
        throw err;
      }
    },
    [driverId, fetchMissions]
  );

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const activeMissions = missions.filter((m) => m.status === 'Active');
  const availableMissions = missions.filter((m) => m.status === 'Available');
  const completedMissions = missions.filter((m) => m.status === 'Completed' || m.status === 'Claimed');

  return {
    missions: filter === 'All' ? missions : missions.filter((m) => m.status === filter),
    isLoading,
    error,
    filter,
    setFilter,
    refresh: fetchMissions,
    claimMission,
    activeMissions,
    availableMissions,
    completedMissions,
  };
}

