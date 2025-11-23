import React from "react";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Lead, Email, Company } from "@shared/schema";
import { LeadCard } from "@/components/lead-card";
import { EmailComposerModal } from "@/components/email-composer-modal";
import { LeadDetailPanel } from "@/components/lead-detail-panel";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Filter, Plus, Building2, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { notificationStore } from "@/lib/notificationStore";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Leads() {
  const [location, setLocation] = useLocation();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [replyingToLead, setReplyingToLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: allLeads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Filter leads based on member permissions
  const leads = useMemo(() => {
    if (user?.role === 'admin') {
      // Admins see all leads
      return allLeads;
    } else if (user?.role === 'member' && user?.permissions) {
      // Members only see leads from their assigned companies
      const allowedCompanyIds = user.permissions.companyIds || [];
      return allLeads.filter(lead => 
        lead.companyId && allowedCompanyIds.includes(lead.companyId)
      );
    }
    // Default: no leads if no permissions
    return [];
  }, [allLeads, user?.role, user?.permissions]);

  const { data: emails = [] } = useQuery<Email[]>({
    queryKey: ['/api/emails', selectedLead?.id],
    enabled: !!selectedLead,
  });

  // Handle selected lead from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const selectedId = params.get('selected');
    
    if (selectedId && leads.length > 0) {
      const lead = leads.find(l => l.id === selectedId);
      if (lead) {
        setSelectedLead(lead);
        // Clear the query parameter after selecting
        setLocation('/leads');
      }
    }
  }, [location, leads, setLocation]);

  // When opening a lead, clear its unread counter and trigger a quick inbox sync
  useEffect(() => {
    if (!selectedLead) return;
    // Clear client-side unread badge for this lead
    notificationStore.clearLead(selectedLead.id);
    
    // Dismiss backend notifications for this lead
    (async () => {
      try {
        await fetch(`/api/notifications/dismiss/${selectedLead.id}`, { method: 'POST' });
      } catch (e) {
        console.error('Failed to dismiss notifications:', e);
      }
    })();
    
    // Proactively trigger server-side sync so the thread is fresh
    (async () => {
      try {
        await apiRequest('POST', '/api/emails/sync', {});
        queryClient.invalidateQueries({ queryKey: ['/api/emails', selectedLead.id] });
      } catch (e) {
        // non-blocking
      }
    })();
  }, [selectedLead]);

  const sendEmailMutation = useMutation({
    mutationFn: async ({ leadId, subject, body }: { leadId: string; subject: string; body: string }) => {
      return apiRequest("POST", `/api/leads/${leadId}/send-email`, { subject, body });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Email sent",
        description: "Your email has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      return apiRequest("PATCH", `/api/leads/${leadId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Status updated",
        description: "Lead status has been updated successfully.",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", `/api/leads/bulk-delete`, { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Leads deleted",
        description: `${data.count} lead(s) deleted successfully.`,
      });
      setSelectedLeadIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete leads",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReply = (lead: Lead) => {
    setReplyingToLead(lead);
    setIsComposerOpen(true);
  };

  const handleSendEmail = async (subject: string, body: string) => {
    if (!replyingToLead) return;
    await sendEmailMutation.mutateAsync({
      leadId: replyingToLead.id,
      subject,
      body,
    });
  };

  const handleStatusChange = (leadId: string, newStatus: string) => {
    updateStatusMutation.mutate({ leadId, status: newStatus });
  };

  const handleToggleSelectLead = (leadId: string) => {
    const newSelected = new Set(selectedLeadIds);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeadIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(lead => lead.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedLeadIds.size === 0) return;
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedLeadIds.size > 0) {
      await bulkDeleteMutation.mutateAsync(Array.from(selectedLeadIds));
    }
    setIsDeleteDialogOpen(false);
  };

  // Get the last received email's subject for the lead being replied to
  const lastReceivedEmail = emails
    .filter(email => email.direction === "received")
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    [0];

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.leadDetails && lead.leadDetails.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    
    const matchesCompany = 
      companyFilter === "all" || 
      (companyFilter === "none" && !lead.companyId) ||
      lead.companyId === companyFilter;
    
    return matchesSearch && matchesStatus && matchesCompany;
  });

  const allFilteredSelected = filteredLeads.length > 0 && selectedLeadIds.size === filteredLeads.length;
  const someSelected = selectedLeadIds.size > 0 && selectedLeadIds.size < filteredLeads.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-2">All Leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all your leads
          </p>
        </div>
        <div className="flex gap-2">
          {selectedLeadIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedLeadIds.size} Lead{selectedLeadIds.size !== 1 ? 's' : ''}
            </Button>
          )}
          <Button 
            onClick={() => {
              setEditingLead(null);
              setIsAddLeadOpen(true);
            }}
            className="bg-fmd-green hover:bg-fmd-green-dark"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or details..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-48" data-testid="select-company-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3 h-3" />
                    {company.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Contacted">Contacted</SelectItem>
              <SelectItem value="Qualified">Qualified</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Follow-up">Follow-up</SelectItem>
              <SelectItem value="Closed Won">Closed Won</SelectItem>
              <SelectItem value="Closed Lost">Closed Lost</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter !== "all" || companyFilter !== "all"
                ? "No leads match your filters" 
                : "No leads yet. Import some to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all leads"
                className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
              />
              <p className="text-sm text-muted-foreground" data-testid="text-result-count">
                {selectedLeadIds.size > 0 
                  ? `${selectedLeadIds.size} of ${filteredLeads.length} selected`
                  : `Showing ${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="flex items-start gap-3">
                <Checkbox
                  checked={selectedLeadIds.has(lead.id)}
                  onCheckedChange={() => handleToggleSelectLead(lead.id)}
                  aria-label={`Select ${lead.clientName}`}
                  className="mt-4"
                />
                <div className="flex-1">
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onReply={handleReply}
                    onViewDetails={setSelectedLead}
                    onStatusChange={handleStatusChange}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <EmailComposerModal
        lead={replyingToLead}
        isOpen={isComposerOpen}
        onClose={() => {
          setIsComposerOpen(false);
          setReplyingToLead(null);
        }}
        onSend={handleSendEmail}
        lastReceivedEmailSubject={lastReceivedEmail?.subject}
      />

      <AddLeadDialog
        isOpen={isAddLeadOpen}
        onClose={() => {
          setIsAddLeadOpen(false);
          setEditingLead(null);
        }}
        lead={editingLead}
      />

      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          emails={emails}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
          onReply={handleReply}
          onEdit={(lead) => {
            setEditingLead(lead);
            setIsAddLeadOpen(true);
          }}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? 's' : ''} and all associated emails. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
