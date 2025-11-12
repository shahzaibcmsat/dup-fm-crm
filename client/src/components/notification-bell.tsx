import React from "react";
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
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  // Get leads with unread emails
  const leadsWithUnread = leads.filter(lead => perLeadUnread[lead.id] > 0);

  const handleLeadClick = async (leadId: string) => {
    // Clear the unread count when clicking on the notification
    notificationStore.clearLead(leadId);
    
    // Dismiss backend notifications for this lead
    try {
      await fetch(`/api/notifications/dismiss/${leadId}`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to dismiss notifications:', e);
    }
    
    // Navigate to the lead
    if (onNotificationClick) {
      onNotificationClick(leadId);
    }
  };

  return (
    <Popover>
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
              className="absolute -top-2 -right-2 h-7 w-7 rounded-full p-0 flex items-center justify-center text-sm font-bold animate-pulse shadow-lg"
            >
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Email Notifications</h3>
            {unreadTotal > 0 && (
              <Badge variant="destructive" className="text-base px-3 py-1">
                {unreadTotal} unread
              </Badge>
            )}
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {leadsWithUnread.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 mx-auto mb-3 text-muted-foreground" />
                <p className="text-base text-muted-foreground">No new notifications</p>
              </div>
            ) : (
              leadsWithUnread.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => handleLeadClick(lead.id)}
                  className="p-4 rounded-lg border-2 border-red-500 bg-red-50 hover:bg-red-100 cursor-pointer transition-all shadow-md hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base truncate text-red-900">{lead.clientName}</p>
                      <p className="text-sm text-red-700 truncate">{lead.email}</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0 text-base px-3 py-1 animate-pulse">
                      {perLeadUnread[lead.id]} new
                    </Badge>
                  </div>
                  <p className="text-xs text-red-600 font-medium">
                    Last updated {formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>

          {leadsWithUnread.length > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="w-full text-base"
              onClick={() => notificationStore.reset()}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
