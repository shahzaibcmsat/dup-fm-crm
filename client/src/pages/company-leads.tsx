import React from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Lead, Email, Company } from "@shared/schema";
import { LeadCard } from "@/components/lead-card";
import { EmailComposerModal } from "@/components/email-composer-modal";
import { LeadDetailPanel } from "@/components/lead-detail-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Trash2, AlertCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CompanyLeads() {
  const [, params] = useRoute("/companies/:id");
  const [, setLocation] = useLocation();
  const companyId = params?.id;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [replyingToLead, setReplyingToLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if member has access to this company
  useEffect(() => {
    if (user?.role === "member" && user?.permissions && companyId) {
      const allowedCompanyIds = user.permissions.companyIds || [];
      if (!allowedCompanyIds.includes(companyId)) {
        // Redirect to dashboard if member doesn't have access
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have permission to view this company",
        });
        setLocation("/");
      }
    }
  }, [user, companyId, setLocation, toast]);

  const { data: company, isLoading: companyLoading } = useQuery<Company>({
    queryKey: ['/api/companies', companyId],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}`);
      if (!response.ok) throw new Error('Failed to fetch company');
      return response.json();
    },
    enabled: !!companyId,
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['/api/companies', companyId, 'leads'],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/leads`);
      if (!response.ok) throw new Error('Failed to fetch leads');
      return response.json();
    },
    enabled: !!companyId,
  });

  const { data: emails = [] } = useQuery<Email[]>({
    queryKey: ['/api/emails', selectedLead?.id],
    enabled: !!selectedLead,
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ leadId, subject, body }: { leadId: string; subject: string; body: string }) => {
      return apiRequest("POST", `/api/leads/${leadId}/send-email`, { subject, body });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'leads'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'leads'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'leads'] });
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
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map(lead => lead.id)));
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

  const allSelected = leads.length > 0 && selectedLeadIds.size === leads.length;
  const someSelected = selectedLeadIds.size > 0 && selectedLeadIds.size < leads.length;

  // Get the last received email's subject for the lead being replied to
  const lastReceivedEmail = emails
    .filter(email => email.direction === "received")
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    [0];

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">Company not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-sm text-muted-foreground">
              {selectedLeadIds.size > 0 
                ? `${selectedLeadIds.size} of ${leads.length} selected`
                : `${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
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
      </div>

      {leadsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No leads for this company yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          {leads.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all leads"
                className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
              />
              <p className="text-sm text-muted-foreground">
                {selectedLeadIds.size > 0 ? 'Select all' : 'Select all'}
              </p>
            </div>
          )}
          <div className="space-y-4">
            {leads.map((lead) => (
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

      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          emails={emails}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
          onReply={handleReply}
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
