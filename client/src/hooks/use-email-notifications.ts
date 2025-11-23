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
  const shownNotificationsRef = useRef<Set<string>>(loadShownNotifications());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<number>(5000); // Start with 5 seconds

  useEffect(() => {
    const checkForNotifications = async () => {
      try {
        const response = await fetch('/api/notifications/emails');
        
        if (!response.ok) {
          console.error('❌ CLIENT: Failed to fetch notifications:', response.statusText);
          return;
        }
        
        const data = await response.json();
        console.log(`📡 CLIENT: Received ${data.notifications?.length || 0} notifications from backend`);

        // If backend has NO notifications, clear localStorage
        if (!data.notifications || data.notifications.length === 0) {
          const currentState = notificationStore.getState();
          if (currentState.unreadTotal > 0) {
            console.log('🧹 CLIENT: Backend has no notifications, clearing localStorage counts');
            notificationStore.reset();
          }
          
          // Slow down polling when there are no notifications (exponential backoff)
          if (pollIntervalRef.current < 30000) { // Max 30 seconds
            pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, 30000);
            console.log(`⏱️ CLIENT: No notifications, slowing poll to ${pollIntervalRef.current / 1000}s`);
            scheduleNextCheck();
          }
        } else {
          // Speed up polling when there are notifications
          pollIntervalRef.current = 5000;
        }

        if (data.notifications && data.notifications.length > 0) {
          let newCount = 0;
          
          data.notifications.forEach((notification: EmailNotification) => {
            // Check if this notification has been shown before
            const alreadyShown = shownNotificationsRef.current.has(notification.id);
            console.log(`   📬 Notification ${notification.id} for ${notification.leadName} - Already shown: ${alreadyShown}`);
            
            if (!alreadyShown) {
              console.log(`   🔔 CLIENT: NEW notification - showing toast for ${notification.leadName}`);
              newCount++;
              
              // Show toast
              toast({
                title: "📧 New Email Reply!",
                description: `${notification.leadName} replied: "${notification.subject}"`,
                duration: 8000,
              });
              
              // Mark as shown
              shownNotificationsRef.current.add(notification.id);
              saveShownNotifications(shownNotificationsRef.current);

              // Update unread counter
              notificationStore.increment(notification.leadId);
              
              // Refresh data
              queryClient.invalidateQueries({ queryKey: ['/api/emails', notification.leadId] });
              queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
            } else {
              // Already shown, but update badge count if needed
              const { perLeadUnread } = notificationStore.getState();
              if (!perLeadUnread[notification.leadId] || perLeadUnread[notification.leadId] === 0) {
                console.log(`   🔄 Syncing badge count for ${notification.leadName}`);
                notificationStore.increment(notification.leadId);
              }
            }
          });
          
          if (newCount > 0) {
            console.log(`✨ CLIENT: Showed ${newCount} new toast notifications`);
          }
        } else {
          console.log('   ℹ️ CLIENT: No notifications from backend');
        }
      } catch (error) {
        console.error('❌ CLIENT: Failed to check for notifications:', error);
      }
    };

    const scheduleNextCheck = () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      intervalRef.current = setTimeout(() => {
        checkForNotifications();
        scheduleNextCheck();
      }, pollIntervalRef.current);
    };

    // Check immediately on mount
    console.log('🚀 CLIENT: Starting adaptive notification polling system');
    checkForNotifications();
    scheduleNextCheck();

    return () => {
      console.log('🛑 CLIENT: Stopping notification polling');
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [toast]);
}
