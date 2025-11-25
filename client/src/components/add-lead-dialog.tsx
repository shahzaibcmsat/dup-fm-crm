import React from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Company, Lead } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AddLeadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: Lead | null;
}

export function AddLeadDialog({ isOpen, onClose, lead }: AddLeadDialogProps) {
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [leadDetails, setLeadDetails] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [submissionDate, setSubmissionDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  useEffect(() => {
    if (lead) {
      setClientName(lead.clientName);
      setEmail(lead.email);
      setPhone(lead.phone || "");
      setSubject(lead.subject || "");
      setLeadDetails(lead.leadDetails || "");
      setCompanyId(lead.companyId || "");
      setSubmissionDate((lead as any).submissionDate ? new Date((lead as any).submissionDate) : undefined);
    } else {
      setClientName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setLeadDetails("");
      setCompanyId("");
      setSubmissionDate(undefined);
    }
  }, [lead, isOpen]);

  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/leads", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Lead created",
        description: "Lead has been created successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/leads/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Lead updated",
        description: "Lead has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!clientName.trim()) {
      toast({
        title: "Validation error",
        description: "Client name is required",
        variant: "destructive",
      });
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      toast({
        title: "Validation error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    // Validate phone if provided (allow digits, spaces, dashes, parentheses, plus)
    if (phone && phone.trim()) {
      const phoneRegex = /^[\d\s\-\(\)\+]+$/;
      if (!phoneRegex.test(phone.trim()) || phone.trim().replace(/\D/g, '').length < 10) {
        toast({
          title: "Validation error",
          description: "Please enter a valid phone number (at least 10 digits)",
          variant: "destructive",
        });
        return;
      }
    }

    const data = {
      clientName: clientName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || undefined,
      subject: subject?.trim() || undefined,
      leadDetails: leadDetails?.trim() || undefined,
      companyId: companyId || null,
      status: lead?.status || "New",
      submissionDate: submissionDate ? submissionDate.toISOString() : null,
    };

    if (lead) {
      updateLeadMutation.mutate({ id: lead.id, data });
    } else {
      createLeadMutation.mutate(data);
    }
  };

  const isLoading = createLeadMutation.isPending || updateLeadMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-fmd-burgundy">
            {lead ? "Edit Lead" : "Add New Lead"}
          </DialogTitle>
          <DialogDescription>
            {lead ? "Update lead information" : "Create a new lead in your CRM"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                placeholder="John Doe"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject (Optional)</Label>
              <Input
                id="subject"
                placeholder="Enter subject or inquiry topic"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Company (Optional)</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="submissionDate">Submission Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="submissionDate"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !submissionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {submissionDate ? format(submissionDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={submissionDate}
                    onSelect={setSubmissionDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leadDetails">Lead Details (Optional)</Label>
              <Textarea
                id="leadDetails"
                placeholder="Add notes about this lead..."
                value={leadDetails}
                onChange={(e) => setLeadDetails(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-fmd-green hover:bg-fmd-green-dark"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {lead ? "Update Lead" : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
