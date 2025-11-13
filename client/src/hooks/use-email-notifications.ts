import { useEffect, useRef } from 'react';
import { useToast } from './use-toast';
import { notificationStore } from "@/lib/notificationStore";
import { queryClient } from "@/lib/queryClient";

interface EmailNotification {
  id: string;
  leadId: string;
  leadName: string;
  fromEmail: string;
  subject: string;
  timestamp: string;
}

const SHOWN_NOTIFICATIONS_KEY = 'fmd-shown-notifications';
const MAX_STORED_NOTIFICATIONS = 100;

// Load shown notifications from localStorage
function loadShownNotifications(): Set<string> {
  try {
    const stored = localStorage.getItem(SHOWN_NOTIFICATIONS_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      return new Set(arr);
    }
  } catch (error) {
    console.error('Failed to load shown notifications from localStorage', error);
  }
  return new Set();
}

// Save shown notifications to localStorage
function saveShownNotifications(shown: Set<string>) {
  try {
    // Keep only the most recent ones to avoid localStorage bloat
    const arr = Array.from(shown);
    const trimmed = arr.slice(-MAX_STORED_NOTIFICATIONS);
    localStorage.setItem(SHOWN_NOTIFICATIONS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save shown notifications to localStorage', error);
  }
}

export function useEmailNotifications() {
  const { toast } = useToast();
  const lastCheckRef = useRef<string | null>(null);
  const shownNotificationsRef = useRef<Set<string>>(loadShownNotifications());
  const initializedRef = useRef(false);

  useEffect(() => {
    const checkForNotifications = async () => {
      try {
        // Build URL with optional since parameter
        const url = lastCheckRef.current 
          ? `/api/notifications/emails?since=${lastCheckRef.current}`
          : '/api/notifications/emails';
        
        console.log(`🔍 CLIENT: Polling notifications - URL: ${url}`);
          
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('❌ CLIENT: Failed to fetch notifications:', response.statusText);
          return;
        }
        
        const data = await response.json();
        console.log(`📡 CLIENT: Received response - ${data.notifications?.length || 0} notifications`);

        if (data.notifications && data.notifications.length > 0) {
          console.log(`📬 CLIENT: Processing ${data.notifications.length} notifications`);
          console.log(`   Initialized: ${initializedRef.current}`);
          console.log(`   Shown IDs count: ${shownNotificationsRef.current.size}`);
          
          // On first load, sync backend with frontend - mark all current as already shown
          if (!initializedRef.current) {
            console.log('🔄 CLIENT: Initial sync - marking existing notifications as shown');
            data.notifications.forEach((notification: EmailNotification) => {
              console.log(`   Adding to shown: ${notification.id} for ${notification.leadName}`);
              shownNotificationsRef.current.add(notification.id);
              // Add to notification store without showing toast
              notificationStore.increment(notification.leadId);
            });
            saveShownNotifications(shownNotificationsRef.current);
            initializedRef.current = true;
            
            // Update last check time
            if (data.notifications.length > 0) {
              const sortedByTime = [...data.notifications].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
              lastCheckRef.current = sortedByTime[0].timestamp;
              console.log(`⏰ CLIENT: Set last check time to: ${lastCheckRef.current}`);
            }
            
            // Refresh queries
            queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
            return;
          }
          
          // After initialization, show new notifications as toasts
          let newCount = 0;
          data.notifications.forEach((notification: EmailNotification) => {
            // Only show if we haven't shown this notification before
            if (!shownNotificationsRef.current.has(notification.id)) {
              console.log(`🔔 CLIENT: NEW notification - showing toast for ${notification.leadName}`);
              newCount++;
              
              toast({
                title: "📧 New Email Reply!",
                description: `${notification.leadName} replied: "${notification.subject}"`,
                duration: 8000,
              });
              
              shownNotificationsRef.current.add(notification.id);
              saveShownNotifications(shownNotificationsRef.current);

              // Update unread counters and refresh lead's email thread
              notificationStore.increment(notification.leadId);
              // Refresh emails for that lead (if panel open)
              queryClient.invalidateQueries({ queryKey: ['/api/emails', notification.leadId] });
              // Also refresh leads to reflect status change to Replied
              queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
            } else {
              console.log(`⏭️  CLIENT: Skipping already shown notification: ${notification.id}`);
            }
          });
          
          if (newCount > 0) {
            console.log(`✨ CLIENT: Showed ${newCount} new toast notifications`);
          }

          // Update last check time to the newest notification timestamp
          if (data.notifications.length > 0) {
            // Sort by timestamp to get the latest
            const sortedByTime = [...data.notifications].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            lastCheckRef.current = sortedByTime[0].timestamp;
            console.log(`⏰ CLIENT: Updated last check time to: ${lastCheckRef.current}`);
          }
        } else if (!initializedRef.current) {
          // No notifications on first load - just mark as initialized
          console.log('✅ CLIENT: No notifications on initial load, marking as initialized');
          initializedRef.current = true;
        }
      } catch (error) {
        console.error('❌ CLIENT: Failed to check for notifications:', error);
      }
    };

    // Check immediately on mount
    console.log('🚀 CLIENT: Starting notification polling system');
    checkForNotifications();

    // Then check every 5 seconds for faster notification delivery
    const interval = setInterval(checkForNotifications, 5000);

    return () => {
      console.log('🛑 CLIENT: Stopping notification polling');
      clearInterval(interval);
    };
  }, [toast]);
}
