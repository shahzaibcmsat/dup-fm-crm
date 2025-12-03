import React from "react";
import { Mail, Clock, Building2, Phone, MessageSquare, UserCog, FileText } from "lucide-react";
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
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start gap-1.5 sm:gap-2 mb-1 flex-wrap">
            <h3 className={`font-semibold text-sm sm:text-lg ${hasUnread ? 'text-red-900 font-bold' : 'text-fmd-black'} break-words`} data-testid={`text-client-name-${lead.id}`}>
              {lead.clientName}
            </h3>
            {hasUnread && (
              <Badge variant="destructive" className="animate-pulse text-[9px] sm:text-sm font-bold px-1 sm:px-3 py-0.5 sm:py-1 whitespace-nowrap flex-shrink-0">
                🔔 {unread}
              </Badge>
            )}
            {(lead as any).company && (
              <Badge variant="outline" className="text-[9px] sm:text-sm gap-0.5 sm:gap-1 bg-fmd-green/10 border-fmd-green text-fmd-green font-semibold px-1 sm:px-3 py-0.5 sm:py-1 max-w-[120px] sm:max-w-[180px] flex-shrink-0">
                <Building2 className="w-2.5 h-2.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">{(lead as any).company.name}</span>
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm sm:text-base mb-2">
            {lead.phone && (
              <span className="group relative inline-flex items-center gap-1 sm:gap-2 bg-white border border-gray-200 rounded-md sm:rounded-xl px-1.5 sm:px-3 py-1 sm:py-2 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-emerald-400">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-green-400/10 rounded-md sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center w-4 h-4 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded sm:rounded-lg shadow-sm flex-shrink-0">
                  <Phone className="w-2.5 h-2.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="relative font-semibold text-gray-700 group-hover:text-emerald-700 transition-colors text-[10px] sm:text-sm truncate max-w-[80px] sm:max-w-none">
                  {lead.phone}
                </span>
              </span>
            )}
            <div className="group relative inline-flex items-center gap-1 sm:gap-2 bg-white border border-gray-200 rounded-md sm:rounded-xl px-1.5 sm:px-3 py-1 sm:py-2 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-blue-400 min-w-0 flex-1">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-indigo-400/10 rounded-md sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center w-4 h-4 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded sm:rounded-lg shadow-sm flex-shrink-0">
                <Mail className={`w-2.5 h-2.5 sm:w-4 sm:h-4 ${hasUnread ? 'text-yellow-300 animate-pulse' : 'text-white'}`} />
              </div>
              <span className={`relative font-semibold ${hasUnread ? 'text-red-600 font-bold' : 'text-gray-700 group-hover:text-blue-700'} transition-colors text-[10px] sm:text-sm truncate min-w-0`} data-testid={`text-email-${lead.id}`}>
                {lead.email}
              </span>
              {hasUnread && (
                <span className="absolute -top-0.5 sm:-top-2 -right-0.5 sm:-right-2 bg-gradient-to-br from-red-500 to-pink-600 text-white text-[8px] sm:text-xs font-bold leading-none rounded-full w-3.5 h-3.5 sm:w-6 sm:h-6 flex items-center justify-center shadow-lg animate-bounce ring-1 sm:ring-2 ring-red-200 flex-shrink-0">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
          </div>
          {lead.subject && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-base text-muted-foreground mb-1.5 sm:mb-2 min-w-0">
              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-fmd-burgundy flex-shrink-0" />
              <span className="truncate font-medium min-w-0">{lead.subject}</span>
            </div>
          )}
          {lead.leadDetails && (
            <p className={`text-[10px] sm:text-base line-clamp-2 mb-1.5 sm:mb-2 ${hasUnread ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>
              {lead.leadDetails}
            </p>
          )}
          {assignedUser && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm text-blue-700 mb-1.5 sm:mb-2 min-w-0">
              <UserCog className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
              <span className="font-medium truncate min-w-0">
                Assigned to: <span className="font-semibold truncate">{assignedUser.email}</span>
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 sm:gap-1 text-[10px] sm:text-sm text-muted-foreground">
            {(lead as any).submissionDate && (
              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                <FileText className="w-2.5 h-2.5 sm:w-4 sm:h-4 flex-shrink-0 text-blue-600" />
                <span className="truncate min-w-0">
                  <span className="font-medium">Submitted:</span> {format(new Date((lead as any).submissionDate), 'MMM d, yyyy')}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <Clock className="w-2.5 h-2.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate min-w-0">
                <span className="font-medium">Created:</span> {format(new Date(lead.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 sm:gap-2 flex-shrink-0 w-[85px] sm:w-[120px]">
          {onStatusChange ? (
            <div className="relative w-full">
              <div className={`${statusConfig[lead.status]?.bg || 'bg-gray-500'} ${statusConfig[lead.status]?.text || 'text-white'} px-1.5 sm:px-3 h-6 sm:h-10 rounded sm:rounded-lg font-bold text-[9px] sm:text-sm shadow-md transition-all hover:shadow-lg flex items-center justify-center overflow-hidden`}>
                <span className="truncate block w-full text-center leading-tight">{lead.status}</span>
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
                <SelectContent onClick={(e) => e.stopPropagation()} className="text-xs sm:text-base">
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
                          <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${config?.bg || 'bg-gray-500'} flex-shrink-0`}></div>
                          <span className="font-semibold text-xs sm:text-sm">{status}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className={`${statusConfig[lead.status]?.bg || 'bg-gray-500'} ${statusConfig[lead.status]?.text || 'text-white'} px-1.5 sm:px-3 h-6 sm:h-10 rounded sm:rounded-lg font-bold text-[9px] sm:text-sm shadow-md flex items-center justify-center w-full overflow-hidden`} data-testid={`badge-status-${lead.id}`}>
              <span className="truncate block w-full text-center leading-tight">{lead.status}</span>
            </div>
          )}
          <Button 
            size="sm" 
            className={`h-6 sm:h-10 w-full font-medium text-[9px] sm:text-sm px-1.5 sm:px-3 bg-green-700 hover:bg-green-800 text-white ${hasUnread ? 'animate-pulse ring-1 sm:ring-2 ring-green-400' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(lead);
            }}
            data-testid={`button-view-lead-${lead.id}`}
          >
            <Mail className="w-2.5 h-2.5 sm:w-4 sm:h-4 mr-0 sm:mr-2" />
            <span className="hidden sm:inline">View Lead</span>
            <span className="sm:hidden truncate">View</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
