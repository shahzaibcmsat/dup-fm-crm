import React from "react";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lead, Email } from "@shared/schema";
import { LeadCard } from "@/components/lead-card";
import { EmailComposerModal } from "@/components/email-composer-modal";
import { LeadDetailPanel } from "@/components/lead-detail-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Mail, TrendingUp, Clock, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { notificationStore } from "@/lib/notificationStore";

export default function Dashboard() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [replyingToLead, setReplyingToLead] = useState<Lead | null>(null);
  const { toast } = useToast();

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const { data: emails = [] } = useQuery<Email[]>({
    queryKey: ['/api/emails', selectedLead?.id],
    enabled: !!selectedLead,
  });

  // When opening a lead, clear its unread counter and try to sync inbox quickly
  useEffect(() => {
    if (!selectedLead) return;
    notificationStore.clearLead(selectedLead.id);
    (async () => {
      try {
        await apiRequest('POST', '/api/emails/sync', {});
        queryClient.invalidateQueries({ queryKey: ['/api/emails', selectedLead.id] });
      } catch (e) {
        // ignore
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

  const stats = {
    total: leads.length,
    active: leads.filter(l => !l.status.includes("Closed")).length,
    contacted: leads.filter(l => l.status === "Contacted" || l.status === "Qualified").length,
    conversion: leads.length > 0 
      ? Math.round((leads.filter(l => l.status === "Closed Won").length / leads.length) * 100) 
      : 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-fmd-burgundy via-fmd-black to-fmd-green bg-clip-text text-transparent">
          Sales Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your leads and performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-fmd-burgundy shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Leads</p>
                <p className="text-3xl font-bold mt-2 text-fmd-burgundy" data-testid="stat-total-leads">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-fmd-burgundy/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-fmd-burgundy" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Active</p>
                <p className="text-3xl font-bold mt-2 text-blue-600" data-testid="stat-active-leads">{stats.active}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-fmd-green shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Contacted</p>
                <p className="text-3xl font-bold mt-2 text-fmd-green" data-testid="stat-contacted-leads">{stats.contacted}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-fmd-green/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-fmd-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Conversion</p>
                <p className="text-3xl font-bold mt-2 text-amber-600" data-testid="stat-conversion-rate">{stats.conversion}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-fmd-black">Recent Leads</h2>
        </div>

        {leadsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No leads yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start by importing your leads from Excel or Google Sheets
              </p>
              <Button asChild data-testid="button-get-started">
                <a href="/import">Get Started</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leads.slice(0, 10).map((lead) => (
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
      </div>

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
