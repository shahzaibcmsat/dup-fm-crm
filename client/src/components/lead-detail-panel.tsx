import React from "react";
import { X, Mail, Clock, User, Edit, ChevronDown, ChevronUp, Phone, MessageSquare, Save, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lead, Email } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useEffect } from "react";

interface LeadDetailPanelProps {
  lead: Lead | null;
  emails: Email[];
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onReply: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onUpdateNotes?: (leadId: string, notes: string) => void;
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

export function LeadDetailPanel({ lead, emails, onClose, onStatusChange, onReply, onEdit, onUpdateNotes }: LeadDetailPanelProps) {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState(lead?.notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Sync notes when lead changes
  useEffect(() => {
    setNotes(lead?.notes || "");
    setIsEditingNotes(false); // Exit edit mode when lead changes
  }, [lead?.id, lead?.notes]);

  if (!lead) return null;

  const handleSaveNotes = async () => {
    if (!onUpdateNotes) return;
    setIsSavingNotes(true);
    try {
      await onUpdateNotes(lead.id, notes);
      setIsEditingNotes(false); // Exit edit mode after saving
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCancelEdit = () => {
    setNotes(lead?.notes || ""); // Reset to original notes
    setIsEditingNotes(false);
  };

  const hasNotesChanged = notes !== (lead.notes || "");

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
            <label className="text-xs text-muted-foreground mb-3 block font-semibold uppercase tracking-wide">Contact Information</label>
            <div className="flex flex-wrap items-center gap-3">
              {lead.phone && (
                <span className="group relative inline-flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-emerald-400">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-green-400/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center justify-center w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg shadow-sm">
                    <Phone className="w-4.5 h-4.5 text-white" />
                  </div>
                  <span className="relative font-semibold text-gray-700 group-hover:text-emerald-700 transition-colors text-sm">
                    {lead.phone}
                  </span>
                </span>
              )}
              <span className="group relative inline-flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-blue-400">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-indigo-400/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                  <Mail className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="relative font-semibold text-gray-700 group-hover:text-blue-700 transition-colors text-sm" data-testid="text-detail-email">
                  {lead.email}
                </span>
              </span>
            </div>
          </div>

          {lead.subject && (
            <div>
              <label className="text-xs text-muted-foreground">Subject</label>
              <div className="flex items-center gap-2 mt-1">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">{lead.subject}</p>
              </div>
            </div>
          )}

          {lead.leadDetails && (
            <div>
              <label className="text-xs text-muted-foreground">Lead Details</label>
              <p className="text-sm mt-1" data-testid="text-detail-description">{lead.leadDetails}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-3 block font-semibold uppercase tracking-wide">Status</label>
            <div className="relative">
              <div className={`${statusConfig[lead.status]?.bg || 'bg-gray-500'} ${statusConfig[lead.status]?.text || 'text-white'} px-5 py-3 rounded-xl font-bold text-sm shadow-lg ${statusConfig[lead.status]?.ring || ''} transition-all hover:shadow-xl text-center`}>
                {lead.status}
              </div>
              <Select
                value={lead.status}
                onValueChange={(value) => onStatusChange(lead.id, value)}
              >
                <SelectTrigger className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
                          <div className={`w-3 h-3 rounded-full ${config?.bg || 'bg-gray-500'}`}></div>
                          <span className="font-semibold">{status}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
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

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notes / Comments
              </label>
              {!isEditingNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingNotes(true)}
                  className="h-8"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {isEditingNotes ? (
                <>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add internal notes or comments about this lead..."
                    className="min-h-[120px] text-sm resize-none"
                    data-testid="textarea-notes"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="flex-1 bg-fmd-green hover:bg-fmd-green/90"
                      size="sm"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isSavingNotes ? "Saving..." : "Save Notes"}
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      disabled={isSavingNotes}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div 
                  className="min-h-[120px] p-3 rounded-md border bg-muted/30 text-sm whitespace-pre-wrap"
                  data-testid="notes-display"
                >
                  {notes || <span className="text-muted-foreground italic">No notes yet. Click Edit to add notes.</span>}
                </div>
              )}
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
