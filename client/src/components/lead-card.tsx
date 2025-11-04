import React from "react";
import { Mail, Clock, Building2, Phone, MessageSquare } from "lucide-react";
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
}

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  New: "default",
  Contacted: "secondary",
  Qualified: "outline",
  "In Progress": "secondary",
  "Follow-up": "secondary",
  "Closed Won": "default",
  "Closed Lost": "outline",
  "Closed": "outline",
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

export function LeadCard({ lead, onReply, onViewDetails, onStatusChange }: LeadCardProps) {
  const { perLeadUnread } = useUnreadEmailCounts();
  const unread = perLeadUnread[lead.id] || 0;
  const hasUnread = unread > 0;
  
  return (
    <Card 
      className={`p-4 hover-elevate cursor-pointer transition-all hover:shadow-lg border-l-4 ${
        hasUnread 
          ? 'border-l-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-300 shadow-lg animate-pulse' 
          : 'border-l-fmd-burgundy/30 hover:border-l-fmd-burgundy'
      }`}
      onClick={() => onViewDetails(lead)}
      data-testid={`card-lead-${lead.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold text-base truncate ${hasUnread ? 'text-red-900 font-bold' : 'text-fmd-black'}`} data-testid={`text-client-name-${lead.id}`}>
              {lead.clientName}
            </h3>
            {hasUnread && (
              <Badge variant="destructive" className="animate-pulse text-sm font-bold px-3 py-1">
                🔔 {unread} NEW REPLY{unread > 1 ? 'IES' : ''}!
              </Badge>
            )}
            {(lead as any).company && (
              <Badge variant="outline" className="text-xs gap-1">
                <Building2 className="w-3 h-3" />
                {(lead as any).company.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 relative">
            <div className="relative">
              <Mail className={`w-4 h-4 ${hasUnread ? 'text-red-600' : 'text-fmd-green'}`} />
              {hasUnread && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold leading-none rounded-full w-5 h-5 flex items-center justify-center shadow-lg animate-pulse">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            <span className={`truncate ${hasUnread ? 'text-red-800 font-semibold' : ''}`} data-testid={`text-email-${lead.id}`}>{lead.email}</span>
          </div>
          {lead.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Phone className="w-4 h-4 text-fmd-green" />
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
          {lead.subject && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MessageSquare className="w-4 h-4 text-fmd-burgundy" />
              <span className="truncate font-medium">{lead.subject}</span>
            </div>
          )}
          {lead.leadDetails && (
            <p className={`text-sm line-clamp-2 mb-2 ${hasUnread ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>
              {lead.leadDetails}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Added {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })} 
              <span className="mx-1">•</span>
              {format(new Date(lead.createdAt), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {onStatusChange ? (
            <Select 
              value={lead.status} 
              onValueChange={(value) => {
                onStatusChange(lead.id, value);
              }}
            >
              <SelectTrigger 
                className="w-36 min-h-8 font-medium" 
                onClick={(e) => e.stopPropagation()}
                data-testid={`select-status-${lead.id}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent onClick={(e) => e.stopPropagation()}>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status} data-testid={`option-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={statusVariants[lead.status] || "default"} className="font-medium" data-testid={`badge-status-${lead.id}`}>
              {lead.status.toUpperCase()}
            </Badge>
          )}
          <Button 
            size="sm" 
            className={`font-medium ${hasUnread ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : 'bg-fmd-green hover:bg-fmd-green-dark text-white'}`}
            onClick={(e) => {
              e.stopPropagation();
              onReply(lead);
            }}
            data-testid={`button-reply-${lead.id}`}
          >
            <Mail className="w-3.5 h-3.5 mr-2" />
            {hasUnread ? 'View Reply' : 'Reply'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
