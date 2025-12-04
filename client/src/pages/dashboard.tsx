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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Users, Mail, TrendingUp, Clock, Loader2, Search, Filter, Plus, Building2, Trash2, UserCog } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { notificationStore } from "@/lib/notificationStore";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
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
  const [isAssignCompanyDialogOpen, setIsAssignCompanyDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [bulkAssignUserId, setBulkAssignUserId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 10;
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: allLeads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Fetch all users for assignment
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Filter leads based on assignment
  const leads = useMemo(() => {
    if (user?.role === 'admin') {
      // Admins see all leads
      return allLeads;
    } else if (user?.role === 'member' && user?.id) {
      // Members only see leads assigned to them
      return allLeads.filter(lead => lead.assignedTo === user.id);
    }
    // Default: no leads
    return [];
  }, [allLeads, user?.role, user?.id]);

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
        setLocation('/');
      }
    }
  }, [location, leads, setLocation]);

  // Update selectedLead when leads data changes (e.g., after saving notes)
  useEffect(() => {
    if (selectedLead && leads.length > 0) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        setSelectedLead(updatedLead);
      }
    }
  }, [leads]);

  // When opening a lead, clear its unread counter and try to sync inbox quickly
  useEffect(() => {
    if (!selectedLead) return;
    notificationStore.clearLead(selectedLead.id);
    (async () => {
      try {
        // Dismiss backend notifications for this lead
        await apiRequest('POST', `/api/notifications/dismiss/${selectedLead.id}`, {});
        // Sync inbox to get latest emails
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

  const bulkAssignCompanyMutation = useMutation({
    mutationFn: async ({ leadIds, companyId }: { leadIds: string[]; companyId: string | null }) => {
      return apiRequest("POST", `/api/leads/bulk-assign-company`, { leadIds, companyId });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Company assigned",
        description: `${data.count || 'Leads'} lead(s) assigned successfully.`,
      });
      setSelectedLeadIds(new Set());
      setIsAssignCompanyDialogOpen(false);
      setSelectedCompanyId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to assign company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ leadIds, userId }: { leadIds: string[]; userId: string }) => {
      return apiRequest("POST", `/api/leads/bulk-assign-user`, { 
        leadIds, 
        userId: userId === "unassigned" ? null : userId,
        assignedBy: user?.id
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Leads assigned",
        description: `${data.count} lead(s) assigned successfully.`,
      });
      setSelectedLeadIds(new Set());
      setBulkAssignUserId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to assign leads",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ leadId, notes }: { leadId: string; notes: string }) => {
      return apiRequest("PATCH", `/api/leads/${leadId}/notes`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Notes saved",
        description: "Lead notes have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save notes",
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

  const handleUpdateNotes = async (leadId: string, notes: string) => {
    await updateNotesMutation.mutateAsync({ leadId, notes });
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

  const handleAssignCompany = () => {
    if (selectedLeadIds.size === 0) return;
    setIsAssignCompanyDialogOpen(true);
  };

  const confirmAssignCompany = async () => {
    if (selectedLeadIds.size > 0) {
      const companyIdToAssign = selectedCompanyId === "__none__" ? null : selectedCompanyId;
      console.log("🔵 Assigning company:", {
        leadIds: Array.from(selectedLeadIds),
        companyId: companyIdToAssign,
        selectedCompanyId
      });
      await bulkAssignCompanyMutation.mutateAsync({
        leadIds: Array.from(selectedLeadIds),
        companyId: companyIdToAssign,
      });
    }
  };

  // Get the last received email's subject for the lead being replied to
  const lastReceivedEmail = emails
    .filter(email => email.direction === "received")
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    [0];

  const filteredLeads = leads
    .filter((lead) => {
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
    })
    .sort((a, b) => {
      // Sort by updatedAt (most recent first), fallback to createdAt
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
  const startIndex = (currentPage - 1) * leadsPerPage;
  const endIndex = startIndex + leadsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, companyFilter]);

  const stats = {
    total: leads.length,
    active: leads.filter(l => !l.status.includes("Closed")).length,
    contacted: leads.filter(l => l.status === "Contacted" || l.status === "Qualified").length,
    conversion: leads.length > 0 
      ? Math.round((leads.filter(l => l.status === "Closed Won").length / leads.length) * 100) 
      : 0,
  };

  const allFilteredSelected = filteredLeads.length > 0 && selectedLeadIds.size === filteredLeads.length;
  const someSelected = selectedLeadIds.size > 0 && selectedLeadIds.size < filteredLeads.length;

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold tracking-tight bg-gradient-to-r from-fmd-burgundy via-fmd-black to-fmd-green bg-clip-text text-transparent leading-tight">
            Overview of your leads and performance
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedLeadIds.size > 0 && (
            <>
              {user?.role === 'admin' && (
                <Select
                  value={bulkAssignUserId}
                  onValueChange={(value) => {
                    setBulkAssignUserId(value);
                    if (value && selectedLeadIds.size > 0) {
                      bulkAssignMutation.mutate({
                        leadIds: Array.from(selectedLeadIds),
                        userId: value
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-40 sm:w-48 text-sm sm:text-base">
                    <SelectValue placeholder="Set Assignee..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <span>Unassigned</span>
                      </div>
                    </SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex items-center gap-2">
                          <UserCog className="w-3 h-3 text-blue-500" />
                          <span>{u.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                onClick={handleAssignCompany}
                disabled={bulkAssignCompanyMutation.isPending}
                className="text-sm sm:text-base border-fmd-green text-fmd-green hover:bg-fmd-green hover:text-white"
              >
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Assign Company </span>({selectedLeadIds.size})
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={bulkDeleteMutation.isPending}
                className="text-sm sm:text-base"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                Delete {selectedLeadIds.size}
              </Button>
            </>
          )}
          <Button 
            onClick={() => {
              setEditingLead(null);
              setIsAddLeadOpen(true);
            }}
            className="bg-fmd-green hover:bg-fmd-green-dark text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <Card className="border-l-4 border-l-fmd-burgundy shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-3 sm:p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground font-medium truncate">Total Leads</p>
                <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mt-1 text-fmd-burgundy" data-testid="stat-total-leads">{stats.total}</p>
              </div>
              <div className="h-9 w-9 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-full bg-fmd-burgundy/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-fmd-burgundy" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-3 sm:p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground font-medium truncate">Active</p>
                <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mt-1 text-blue-600" data-testid="stat-active-leads">{stats.active}</p>
              </div>
              <div className="h-9 w-9 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-fmd-green shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-3 sm:p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground font-medium truncate">Contacted</p>
                <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mt-1 text-fmd-green" data-testid="stat-contacted-leads">{stats.contacted}</p>
              </div>
              <div className="h-9 w-9 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-full bg-fmd-green/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-fmd-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-3 sm:p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground font-medium truncate">Conversion</p>
                <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mt-1 text-amber-600" data-testid="stat-conversion-rate">{stats.conversion}%</p>
              </div>
              <div className="h-9 w-9 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email..."
            className="pl-9 text-sm h-10 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground hidden sm:block flex-shrink-0" />
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-48 text-sm h-10" data-testid="select-company-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-sm">
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {company.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-48 text-sm h-10" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-sm">
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

      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-fmd-black">All Leads</h2>
          {filteredLeads.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-3">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all leads"
                className={`${someSelected ? "data-[state=checked]:bg-primary/50" : ""} h-5 w-5`}
              />
              <p className="text-xs sm:text-sm lg:text-base text-muted-foreground" data-testid="text-result-count">
                {selectedLeadIds.size > 0 
                  ? `${selectedLeadIds.size} of ${filteredLeads.length} selected`
                  : `${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          )}
        </div>

        {leadsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No leads yet</h3>
              <p className="text-base text-muted-foreground mb-4">
                Start by importing your leads from Excel or CSV
              </p>
              <Button asChild data-testid="button-get-started" className="text-base">
                <a href="/import">Get Started</a>
              </Button>
            </CardContent>
          </Card>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-base text-muted-foreground">
                No leads match your filters. Try adjusting your search or filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3 sm:space-y-4">
              {paginatedLeads.map((lead) => (
                <div key={lead.id} className="flex items-start gap-2 sm:gap-3">
                  <Checkbox
                    checked={selectedLeadIds.has(lead.id)}
                    onCheckedChange={() => handleToggleSelectLead(lead.id)}
                    aria-label={`Select ${lead.clientName}`}
                    className="mt-3 sm:mt-4 h-5 w-5 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <LeadCard
                      lead={lead}
                      onReply={handleReply}
                      onViewDetails={setSelectedLead}
                      onStatusChange={handleStatusChange}
                      users={users}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 sm:pt-4 border-t">
                <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length} leads
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-3 text-xs sm:text-sm"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      const showPage = 
                        page === 1 || 
                        page === totalPages || 
                        (page >= currentPage - 1 && page <= currentPage + 1);
                      
                      const showEllipsis = 
                        (page === currentPage - 2 && currentPage > 3) ||
                        (page === currentPage + 2 && currentPage < totalPages - 2);

                      if (showEllipsis) {
                        return <span key={page} className="px-1 sm:px-2 text-xs sm:text-sm text-muted-foreground">...</span>;
                      }

                      if (!showPage) return null;

                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 p-0 text-xs sm:text-sm ${currentPage === page ? "bg-fmd-green hover:bg-fmd-green-dark" : ""}`}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-3 text-xs sm:text-sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
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
          onUpdateNotes={handleUpdateNotes}
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

      <AlertDialog open={isAssignCompanyDialogOpen} onOpenChange={setIsAssignCompanyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Company to Leads</AlertDialogTitle>
            <AlertDialogDescription>
              Select a company to assign to {selectedLeadIds.size} selected lead{selectedLeadIds.size !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="w-full text-base h-11">
                <SelectValue placeholder="Select a company..." />
              </SelectTrigger>
              <SelectContent className="text-base">
                <SelectItem value="__none__">None (Remove company)</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {company.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCompanyId("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAssignCompany}
              disabled={bulkAssignCompanyMutation.isPending || !selectedCompanyId}
              className="bg-fmd-green text-white hover:bg-fmd-green-dark"
            >
              {bulkAssignCompanyMutation.isPending ? "Assigning..." : "Assign Company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
