import React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImportModal } from "@/components/import-modal";
import { ImportSummaryDialog } from "@/components/import-summary-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface ImportSummary {
  totalRows: number;
  validRows: number;
  newLeads: number;
  duplicateLeads: number;
  invalidRows: number;
  duplicateEmails: string[];
  fileInternalDuplicates: string[];
  rejectedCount: number;
}

interface ImportResponse {
  success: boolean;
  total: number;
  imported: number;
  duplicates: number;
  rejected: number;
  summary: ImportSummary;
}

export default function Import() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const { toast } = useToast();
  
  // Only admins can access import
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/import/file", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to import file");
      }
      
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      
      // Close import modal first
      setIsModalOpen(false);
      
      // Show summary dialog
      setImportSummary(data.summary);
      setIsSummaryOpen(true);
      
      // Show toast notification
      const messages = [];
      if (data.imported > 0) {
        messages.push(`${data.imported} leads imported successfully`);
      }
      if (data.duplicates > 0) {
        messages.push(`${data.duplicates} duplicates found`);
      }
      if (data.rejected > 0) {
        messages.push(`${data.rejected} rejected`);
      }
      
      toast({
        title: "Import completed",
        description: messages.join(', '),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImportFile = async (file: File) => {
    await uploadFileMutation.mutateAsync(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Import Leads</h1>
        <p className="text-sm text-muted-foreground">
          Upload your leads from Excel or CSV files
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="hover-elevate cursor-pointer transition-all" onClick={() => setIsModalOpen(true)}>
          <CardContent className="p-6">
            <Upload className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Excel/CSV File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Import leads from .xlsx or .csv files with client name, email, and lead details
            </p>
            <Button data-testid="button-open-file-import">
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">File Format Requirements</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Required Columns</p>
                <p className="text-sm text-muted-foreground">
                  Name and Email are required. Phone Number, Subject, and Lead Description are optional.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Supported Formats</p>
                <p className="text-sm text-muted-foreground">
                  .xlsx (Excel) and .csv (Comma-separated values)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Column Headers</p>
                <p className="text-sm text-muted-foreground">
                  First row should contain headers: Name, Email, Phone Number, Subject, Lead Description
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Download Template</p>
                <p className="text-sm text-muted-foreground">
                  <a href="/sample-leads-template.xlsx" download className="text-primary hover:underline">
                    Click here to download a sample template
                  </a> with the correct format and example data.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ImportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onImport={handleImportFile}
      />

      <ImportSummaryDialog
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        summary={importSummary}
      />
    </div>
  );
}
