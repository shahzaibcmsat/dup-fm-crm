import React from "react";
import { X, Mail, Clock, User, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lead, Email } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

interface LeadDetailPanelProps {
  lead: Lead | null;
  emails: Email[];
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onReply: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
}

const statusOptions = [
  "New",
  "Contacted",
  "Qualified",
  "Follow-up",
  "Closed Won",
  "Closed Lost",
];

export function LeadDetailPanel({ lead, emails, onClose, onStatusChange, onReply, onEdit }: LeadDetailPanelProps) {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  if (!lead) return null;

  const toggleEmailExpand = (emailId: string) => {
    setExpandedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const stripHtmlTags = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-card border-l shadow-xl overflow-y-auto z-50" data-testid="panel-lead-detail">
      <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lead Details</h2>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={() => onEdit(lead)} title="Edit Lead">
              <Edit className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Client Name</label>
            <div className="flex items-center gap-2 mt-1">
              <User className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium" data-testid="text-detail-name">{lead.clientName}</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm" data-testid="text-detail-email">{lead.email}</p>
            </div>
          </div>

          {lead.leadDetails && (
            <div>
              <label className="text-xs text-muted-foreground">Lead Details</label>
              <p className="text-sm mt-1" data-testid="text-detail-description">{lead.leadDetails}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select
              value={lead.status}
              onValueChange={(value) => onStatusChange(lead.id, value)}
            >
              <SelectTrigger className="mt-1" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status} data-testid={`option-status-${status.toLowerCase().replace(' ', '-')}`}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Added</label>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm">
                {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          <Button className="w-full" onClick={() => onReply(lead)} data-testid="button-reply-detail">
            <Mail className="w-4 h-4 mr-2" />
            Send Email
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Communication History</h3>
          {emails.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No emails yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start the conversation by sending an email
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => {
                const isExpanded = expandedEmails.has(email.id);
                const isHtml = email.body.trim().startsWith('<');
                
                return (
                  <div key={email.id} className="border rounded-lg p-3 space-y-2" data-testid={`email-item-${email.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant={email.direction === "sent" ? "default" : "secondary"}>
                        {email.direction === "sent" ? "Sent" : "Received"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(email.sentAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{email.subject}</p>
                      <div className="mt-1">
                        {isHtml ? (
                          <div 
                            className={`email-content ${!isExpanded ? 'line-clamp-3' : ''}`}
                            dangerouslySetInnerHTML={{ __html: email.body }}
                          />
                        ) : (
                          <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`}>
                            {email.body}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-auto p-0 text-xs"
                          onClick={() => toggleEmailExpand(email.id)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3 mr-1" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3 mr-1" />
                              Read full message
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
