import React from "react";
import { X, Mail, Clock, User, Edit, ChevronDown, ChevronUp, Phone, MessageSquare, Save, FileText, UserCog } from "lucide-react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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
  const { toast } = useToast();

  // Fetch all users for assignment dropdown
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: async ({ leadId, userId, assignedBy }: { leadId: string; userId: string | null; assignedBy?: string }) => {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, assignedBy }),
      });
      if (!res.ok) throw new Error('Failed to assign lead');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Lead assigned",
        description: "Lead assignment updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    <div className="fixed right-0 top-0 h-screen w-full sm:w-[500px] md:w-[550px] lg:w-[600px] bg-card border-l shadow-xl overflow-y-auto z-50" data-testid="panel-lead-detail">
      <div className="sticky top-0 bg-card border-b p-4 sm:p-5 flex items-center justify-between z-10 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-semibold">Lead Details</h2>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={() => onEdit(lead)} title="Edit Lead" className="h-10 w-10">
              <Edit className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel" className="h-10 w-10">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6 sm:space-y-7">
        <div className="space-y-5 sm:space-y-6">
          <div>
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Client Name</label>
            <div className="flex items-center gap-3 mt-2">
              <User className="w-5 h-5 text-muted-foreground" />
              <p className="text-lg font-semibold" data-testid="text-detail-name">{lead.clientName}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block uppercase tracking-wide">Contact Information</label>
            <div className="flex flex-col gap-3">
              {lead.phone && (
                <span className="group relative inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3.5 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-green-400/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center justify-center w-11 h-11 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg shadow-sm">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <span className="relative font-semibold text-gray-700 group-hover:text-emerald-700 transition-colors text-base">
                    {lead.phone}
                  </span>
                </span>
              )}
              <span className="group relative inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3.5 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-blue-400">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-indigo-400/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <span className="relative font-semibold text-gray-700 group-hover:text-blue-700 transition-colors text-base break-all" data-testid="text-detail-email">
                  {lead.email}
                </span>
              </span>
            </div>
          </div>

          {lead.subject && (
            <div>
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Subject</label>
              <div className="flex items-center gap-3 mt-2">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                <p className="text-base font-medium">{lead.subject}</p>
              </div>
            </div>
          )}

          {lead.leadDetails && (
            <div>
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Lead Details</label>
              <p className="text-base mt-2 leading-relaxed" data-testid="text-detail-description">{lead.leadDetails}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block uppercase tracking-wide">Status</label>
            <div className="relative">
              <div className={`${statusConfig[lead.status]?.bg || 'bg-gray-500'} ${statusConfig[lead.status]?.text || 'text-white'} px-6 py-4 rounded-xl font-bold text-base shadow-lg ${statusConfig[lead.status]?.ring || ''} transition-all hover:shadow-xl text-center`}>
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
            <label className="text-sm font-medium text-muted-foreground mb-3 block uppercase tracking-wide">Assigned To</label>
            <Select
              value={lead.assignedTo || "unassigned"}
              onValueChange={(value) => {
                const userId = value === "unassigned" ? null : value;
                assignMutation.mutate({ leadId: lead.id, userId });
              }}
              disabled={assignMutation.isPending}
            >
              <SelectTrigger className="w-full h-12 text-base">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <span className="font-medium text-gray-500">Unassigned</span>
                  </div>
                </SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <UserCog className="w-3 h-3 text-blue-500" />
                      <span className="font-medium">{user.email}</span>
                      {user.role === 'admin' && (
                        <Badge variant="outline" className="text-xs">Admin</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lead.assignedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Assigned {formatDistanceToNow(new Date(lead.assignedAt), { addSuffix: true })}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Dates</label>
            <div className="flex flex-col gap-3 mt-2">
              {(lead as any).submissionDate && (
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <p className="text-base">
                    <span className="font-semibold text-blue-700">Submitted:</span> {format(new Date((lead as any).submissionDate), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <p className="text-base">
                  <span className="font-semibold">Created:</span> {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Notes / Comments
              </label>
              {!isEditingNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingNotes(true)}
                  className="h-10"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {isEditingNotes ? (
                <>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add internal notes or comments about this lead..."
                    className="min-h-[140px] text-base resize-none"
                    data-testid="textarea-notes"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="flex-1 bg-fmd-green hover:bg-fmd-green/90 h-11 text-base"
                      size="sm"
                    >
                      <Save className="w-5 h-5 mr-2" />
                      {isSavingNotes ? "Saving..." : "Save Notes"}
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      disabled={isSavingNotes}
                      variant="outline"
                      size="sm"
                      className="h-11 text-base"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div 
                  className="min-h-[140px] p-4 rounded-md border bg-muted/30 text-base leading-relaxed whitespace-pre-wrap"
                  data-testid="notes-display"
                >
                  {notes || <span className="text-muted-foreground italic">No notes yet. Click Edit to add notes.</span>}
                </div>
              )}
            </div>
          </div>

          <Button className="w-full h-12 text-base font-semibold" onClick={() => onReply(lead)} data-testid="button-reply-detail">
            <Mail className="w-5 h-5 mr-2" />
            Send Email
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-base sm:text-lg font-semibold">Communication History</h3>
          {emails.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-14 h-14 mx-auto mb-4 text-muted-foreground" />
              <p className="text-base text-muted-foreground">No emails yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start the conversation by sending an email
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {emails.map((email) => {
                const isExpanded = expandedEmails.has(email.id);
                const isHtml = email.body.trim().startsWith('<');
                
                return (
                  <div key={email.id} className="border rounded-lg p-4 space-y-3" data-testid={`email-item-${email.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant={email.direction === "sent" ? "default" : "secondary"} className="text-sm px-3 py-1">
                        {email.direction === "sent" ? "Sent" : "Received"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(email.sentAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-semibold">{email.subject}</p>
                      <div className="mt-2">
                        {isHtml ? (
                          <div 
                            className={`email-content text-base ${!isExpanded ? 'line-clamp-3' : ''}`}
                            dangerouslySetInnerHTML={{ __html: email.body }}
                          />
                        ) : (
                          <p className={`text-base text-muted-foreground whitespace-pre-wrap leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
                            {email.body}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 h-auto p-0 text-sm font-medium"
                          onClick={() => toggleEmailExpand(email.id)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4 mr-1" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4 mr-1" />
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
