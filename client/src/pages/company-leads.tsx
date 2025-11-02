import React from "react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Lead, Email, Company } from "@shared/schema";
import { LeadCard } from "@/components/lead-card";
import { EmailComposerModal } from "@/components/email-composer-modal";
import { LeadDetailPanel } from "@/components/lead-detail-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CompanyLeads() {
  const [, params] = useRoute("/companies/:id");
  const companyId = params?.id;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [replyingToLead, setReplyingToLead] = useState<Lead | null>(null);
  const { toast } = useToast();

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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          <p className="text-sm text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? 's' : ''}
          </p>
        </div>
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
        <div className="space-y-4">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onReply={handleReply}
              onViewDetails={setSelectedLead}
              onStatusChange={handleStatusChange}
            />
          ))}
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
    </div>
  );
}
