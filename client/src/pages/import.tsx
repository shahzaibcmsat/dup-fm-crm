import React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImportModal } from "@/components/import-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Import() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

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
      
      return response.json() as Promise<{ success: boolean; count: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Import successful",
        description: `Imported ${data.count} leads successfully.`,
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
                  Your file must have columns for: Client Name, Email, and Lead Details
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
                  First row should contain headers. Acceptable headers: "Client Name", "Name", "Email", "Lead", "Lead Details", "Description"
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
    </div>
  );
}
