import { useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { checkUpcomingEvents } from '../utils/notificationUtils';

/**
 * Hook to automatically check for upcoming events and create notifications
 * Runs once per day to avoid excessive checks
 */
export function useUpcomingEventNotifications() {
  useEffect(() => {
    console.log('[useUpcomingEventNotifications] Hook mounted');
    const minHoursBetweenChecks = import.meta.env.DEV ? 0 : 24;
    
    const checkNotifications = async (userId) => {
      console.log('[useUpcomingEventNotifications] checkNotifications called with userId:', userId);
      
      if (!userId) {
        console.log('[useUpcomingEventNotifications] No userId, skipping');
        return;
      }

      // Check if we've already checked today
      const lastCheckKey = `lastUpcomingEventCheck_${userId}`;
      const lastCheck = localStorage.getItem(lastCheckKey);
      const now = new Date();
      
      console.log('[useUpcomingEventNotifications] Last check:', lastCheck);
      
      if (lastCheck) {
        const lastCheckDate = new Date(lastCheck);
        const hoursSinceLastCheck = (now - lastCheckDate) / (1000 * 60 * 60);
        
        console.log('[useUpcomingEventNotifications] Hours since last check:', hoursSinceLastCheck);
        
        // Only check once every 24 hours (prod). In dev, allow immediate re-checks.
        if (hoursSinceLastCheck < minHoursBetweenChecks) {
          console.log('[useUpcomingEventNotifications] Checked recently, skipping');
          return;
        }
      }

      // Perform the check
      console.log('[useUpcomingEventNotifications] Performing check...');
      try {
        await checkUpcomingEvents(userId);
        localStorage.setItem(lastCheckKey, now.toISOString());
        console.log('[useUpcomingEventNotifications] Check complete, saved timestamp');
      } catch (error) {
        console.error('Error checking upcoming events:', error);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log('[useUpcomingEventNotifications] Auth state changed:', user?.uid);
      if (user) {
        checkNotifications(user.uid);
      }
    });

    return () => {
      console.log('[useUpcomingEventNotifications] Hook unmounting');
      unsubscribe();
    };
  }, []);
}
