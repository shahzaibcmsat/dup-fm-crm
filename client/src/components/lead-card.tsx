import React from "react";
import { Mail, Clock, Building2, Phone, MessageSquare, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { useUnreadEmailCounts } from "@/lib/notificationStore";

interface LeadCardProps {
  lead: Lead;
  onReply: (lead: Lead) => void;
  onViewDetails: (lead: Lead) => void;
  onStatusChange?: (leadId: string, status: string) => void;
  users?: any[];
}

const statusConfig: Record<string, { bg: string; text: string; ring: string }> = {
  "New": { 
    bg: "bg-gradient-to-r from-blue-500 to-indigo-600", 
    text: "text-white", 
    ring: "ring-2 ring-blue-300 ring-offset-2" 
  },
  "Contacted": { 
    bg: "bg-gradient-to-r from-purple-500 to-pink-600", 
    text: "text-white", 
    ring: "ring-2 ring-purple-300 ring-offset-2" 
  },
  "Qualified": { 
    bg: "bg-gradient-to-r from-emerald-500 to-green-600", 
    text: "text-white", 
    ring: "ring-2 ring-emerald-300 ring-offset-2" 
  },
  "In Progress": { 
    bg: "bg-gradient-to-r from-amber-500 to-orange-600", 
    text: "text-white", 
    ring: "ring-2 ring-amber-300 ring-offset-2" 
  },
  "Follow-up": { 
    bg: "bg-gradient-to-r from-cyan-500 to-teal-600", 
    text: "text-white", 
    ring: "ring-2 ring-cyan-300 ring-offset-2" 
  },
  "Closed Won": { 
    bg: "bg-gradient-to-r from-green-600 to-emerald-700", 
    text: "text-white", 
    ring: "ring-2 ring-green-400 ring-offset-2" 
  },
  "Closed Lost": { 
    bg: "bg-gradient-to-r from-red-500 to-rose-600", 
    text: "text-white", 
    ring: "ring-2 ring-red-300 ring-offset-2" 
  },
  "Closed": { 
    bg: "bg-gradient-to-r from-gray-500 to-slate-600", 
    text: "text-white", 
    ring: "ring-2 ring-gray-300 ring-offset-2" 
  },
};

const statusOptions = [
  "New",
  "Contacted",
  "Qualified",
  "In Progress",
  "Follow-up",
  "Closed Won",
  "Closed Lost",
  "Closed"
];

export function LeadCard({ lead, onReply, onViewDetails, onStatusChange, users = [] }: LeadCardProps) {
  const { perLeadUnread } = useUnreadEmailCounts();
  const unread = perLeadUnread[lead.id] || 0;
  const hasUnread = unread > 0;
  
  // Find the assigned user
  const assignedUser = lead.assignedTo ? users.find(u => u.id === lead.assignedTo) : null;
  
  return (
    <Card 
      className={`p-3 sm:p-4 hover-elevate cursor-pointer transition-all hover:shadow-lg border-l-4 ${
        hasUnread 
          ? 'border-l-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-300 shadow-lg animate-pulse' 
          : 'border-l-fmd-burgundy/30 hover:border-l-fmd-burgundy'
      }`}
      onClick={() => onViewDetails(lead)}
      data-testid={`card-lead-${lead.id}`}
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className={`font-semibold text-base sm:text-lg truncate ${hasUnread ? 'text-red-900 font-bold' : 'text-fmd-black'}`} data-testid={`text-client-name-${lead.id}`}>
              {lead.clientName}
            </h3>
            {hasUnread && (
              <Badge variant="destructive" className="animate-pulse text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1">
                🔔 {unread} NEW REPLY{unread > 1 ? 'IES' : ''}!
              </Badge>
            )}
            {(lead as any).company && (
              <Badge variant="outline" className="text-xs sm:text-sm gap-1 bg-fmd-green/10 border-fmd-green text-fmd-green font-semibold px-2 sm:px-3 py-0.5 sm:py-1">
                <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
                {(lead as any).company.name}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base mb-2">
            {lead.phone && (
              <span className="group relative inline-flex items-center gap-1.5 sm:gap-2 bg-white border border-gray-200 rounded-lg sm:rounded-xl px-2 sm:px-4 py-1.5 sm:py-2 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-emerald-400">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-green-400/10 rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-md sm:rounded-lg shadow-sm">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="relative font-semibold text-gray-700 group-hover:text-emerald-700 transition-colors text-xs sm:text-base">
                  {lead.phone}
                </span>
              </span>
            )}
            <div className="group relative inline-flex items-center gap-1.5 sm:gap-2 bg-white border border-gray-200 rounded-lg sm:rounded-xl px-2 sm:px-4 py-1.5 sm:py-2 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-blue-400">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-indigo-400/10 rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md sm:rounded-lg shadow-sm">
                <Mail className={`w-3 h-3 sm:w-4 sm:h-4 ${hasUnread ? 'text-yellow-300 animate-pulse' : 'text-white'}`} />
              </div>
              <span className={`relative font-semibold ${hasUnread ? 'text-red-600 font-bold' : 'text-gray-700 group-hover:text-blue-700'} transition-colors text-xs sm:text-base truncate max-w-[150px] sm:max-w-none`} data-testid={`text-email-${lead.id}`}>
                {lead.email}
              </span>
              {hasUnread && (
                <span className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 bg-gradient-to-br from-red-500 to-pink-600 text-white text-xs font-bold leading-none rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-lg animate-bounce ring-2 ring-red-200">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
          </div>
          {lead.subject && (
            <div className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground mb-2">
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-fmd-burgundy flex-shrink-0" />
              <span className="truncate font-medium">{lead.subject}</span>
            </div>
          )}
          {lead.leadDetails && (
            <p className={`text-sm sm:text-base line-clamp-2 mb-2 ${hasUnread ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>
              {lead.leadDetails}
            </p>
          )}
          {assignedUser && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-700 mb-2">
              <UserCog className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
              <span className="font-medium">
                Assigned to: <span className="font-semibold">{assignedUser.email}</span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="truncate">
              Added {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })} 
              <span className="mx-1 hidden sm:inline">•</span>
              <span className="hidden sm:inline">{format(new Date(lead.createdAt), 'MMM d, yyyy')}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {onStatusChange ? (
            <div className="relative w-full min-w-[100px] sm:min-w-[120px]">
              <div className={`${statusConfig[lead.status]?.bg || 'bg-gray-500'} ${statusConfig[lead.status]?.text || 'text-white'} px-2 sm:px-4 h-8 sm:h-10 rounded-lg font-bold text-xs sm:text-base shadow-md ${statusConfig[lead.status]?.ring || ''} transition-all hover:shadow-lg flex items-center justify-center`}>
                {lead.status}
              </div>
              <Select 
                value={lead.status} 
                onValueChange={(value) => {
                  onStatusChange(lead.id, value);
                }}
              >
                <SelectTrigger 
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" 
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`select-status-${lead.id}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent onClick={(e) => e.stopPropagation()} className="text-sm sm:text-base">
                  {statusOptions.map((status) => {
                    const config = statusConfig[status];
                    return (
                      <SelectItem 
                        key={status} 
                        value={status} 
                        data-testid={`option-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${config?.bg || 'bg-gray-500'}`}></div>
                          <span className="font-semibold">{status}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className={`${statusConfig[lead.status]?.bg || 'bg-gray-500'} ${statusConfig[lead.status]?.text || 'text-white'} px-2 sm:px-4 h-8 sm:h-10 rounded-lg font-bold text-xs sm:text-base shadow-md ${statusConfig[lead.status]?.ring || ''} flex items-center justify-center w-full min-w-[100px] sm:min-w-[120px]`} data-testid={`badge-status-${lead.id}`}>
              {lead.status}
            </div>
          )}
          <Button 
            size="sm" 
            className={`h-8 sm:h-10 w-full font-medium text-xs sm:text-base bg-green-700 hover:bg-green-800 text-white ${hasUnread ? 'animate-pulse ring-2 ring-green-400' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(lead);
            }}
            data-testid={`button-view-lead-${lead.id}`}
          >
            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            View Lead
          </Button>
        </div>
      </div>
    </Card>
  );
}
