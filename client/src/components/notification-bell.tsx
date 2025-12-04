import React, { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useUnreadEmailCounts } from "@/lib/notificationStore";
import { useQuery } from "@tanstack/react-query";
import { Lead } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { notificationStore } from "@/lib/notificationStore";

interface NotificationBellProps {
  onNotificationClick?: (leadId: string) => void;
}

export function NotificationBell({ onNotificationClick }: NotificationBellProps) {
  const { unreadTotal, perLeadUnread } = useUnreadEmailCounts();
  const [isOpen, setIsOpen] = useState(false);
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  // Get leads with unread emails
  const leadsWithUnread = leads.filter(lead => perLeadUnread[lead.id] > 0);

  // Helper function to dismiss with retry logic
  const dismissWithRetry = async (url: string, retries = 2): Promise<boolean> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const resp = await fetch(url, { method: 'POST' });
        if (resp.ok) return true;
        console.warn(`Dismiss returned ${resp.status}, attempt ${i + 1}`);
      } catch (e) {
        console.error(`Dismiss failed attempt ${i + 1}:`, e);
      }
      // Small backoff between retries
      if (i < retries) {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
      }
    }
    return false;
  };

  const handleLeadClick = async (leadId: string) => {
    console.log(`🔔 BELL: User clicked notification for lead: ${leadId}`);
    
    // Clear the unread count when clicking on the notification
    notificationStore.clearLead(leadId);
    console.log(`   ✅ BELL: Cleared frontend badge for lead: ${leadId}`);
    
    // Dismiss backend notifications for this lead with retry
    const dismissed = await dismissWithRetry(`/api/notifications/dismiss/${leadId}`);
    console.log(`   ${dismissed ? '✅' : '❌'} BELL: Backend dismissal ${dismissed ? 'successful' : 'failed'}`);
    
    // Close the popover
    setIsOpen(false);
    console.log(`   ✅ BELL: Closed popover`);
    
    // Navigate to the lead
    if (onNotificationClick) {
      onNotificationClick(leadId);
      console.log(`   ✅ BELL: Navigating to lead`);
    }
  };

  const handleMarkAllRead = async () => {
    console.log(`🔔 BELL: User clicked Mark All as Read for ${leadsWithUnread.length} leads`);
    
    // Clear all notifications on frontend
    notificationStore.reset();
    console.log(`   ✅ BELL: Cleared all frontend badges`);
    
    // Dismiss all notifications on backend
    for (const lead of leadsWithUnread) {
      await dismissWithRetry(`/api/notifications/dismiss/${lead.id}`);
    }
    console.log(`   ✅ BELL: Dismissed all on backend`);
    
    // Close the popover
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white hover:bg-white/20 h-12 w-12"
          data-testid="notification-bell"
        >
          <Bell className={`h-7 w-7 ${unreadTotal > 0 ? 'animate-pulse' : ''}`} />
          {unreadTotal > 0 && (
            <Badge
              variant="destructive"
              className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold animate-pulse shadow-lg z-10"
            >
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Email Notifications</h3>
            {unreadTotal > 0 && (
              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                {unreadTotal} unread
              </Badge>
            )}
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {leadsWithUnread.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No new notifications</p>
              </div>
            ) : (
              leadsWithUnread.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => handleLeadClick(lead.id)}
                  className="p-3 rounded-lg border-2 border-red-200 bg-red-50 hover:bg-red-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-red-900">{lead.clientName}</p>
                      <p className="text-xs text-red-700 truncate mt-0.5">{lead.email}</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0 text-xs px-2 py-0.5 animate-pulse">
                      {perLeadUnread[lead.id]} new
                    </Badge>
                  </div>
                  <p className="text-xs text-red-600 font-medium mt-1.5">
                    Last updated {formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>

          {leadsWithUnread.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-sm"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
