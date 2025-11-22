import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, FileCheck } from "lucide-react";

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

interface ImportSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ImportSummary | null;
}

export function ImportSummaryDialog({
  isOpen,
  onClose,
  summary,
}: ImportSummaryDialogProps) {
  if (!summary) return null;

  const totalProcessed = summary.newLeads + summary.duplicateLeads;
  const successRate = summary.validRows > 0 
    ? ((summary.newLeads / summary.validRows) * 100).toFixed(1) 
    : "0";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileCheck className="w-6 h-6 text-green-600" />
            Import Summary
          </DialogTitle>
          <DialogDescription>
            Here's a detailed breakdown of your import results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overall Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-muted-foreground mb-1">Total Rows</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {summary.totalRows}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-muted-foreground mb-1">Success Rate</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {successRate}%
              </p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-600 text-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    Successfully Imported
                  </p>
                  <p className="text-sm text-muted-foreground">
                    New leads added to your database
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {summary.newLeads}
              </p>
            </div>

            {summary.duplicateLeads > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-yellow-600 text-white">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-yellow-700 dark:text-yellow-400">
                      Duplicates Detected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      These emails already exist in database
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {summary.duplicateLeads}
                </p>
              </div>
            )}

            {summary.rejectedCount > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-red-600 text-white">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">
                      Rejected Leads
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Failed to import due to database constraints
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {summary.rejectedCount}
                </p>
              </div>
            )}

            {summary.invalidRows > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-red-600 text-white">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">
                      Invalid Rows
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Missing required fields (Name or Email)
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {summary.invalidRows}
                </p>
              </div>
            )}
          </div>

          {/* Duplicate Details */}
          {summary.duplicateEmails.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                Duplicate Emails Found ({summary.duplicateEmails.length})
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                These emails already exist in your database. They were attempted to import but may have been rejected by database constraints.
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {summary.duplicateEmails.slice(0, 20).map((email, idx) => (
                  <div
                    key={idx}
                    className="text-sm px-3 py-1.5 bg-background rounded border text-muted-foreground font-mono"
                  >
                    {email}
                  </div>
                ))}
                {summary.duplicateEmails.length > 20 && (
                  <p className="text-sm text-muted-foreground italic px-3 py-1">
                    ... and {summary.duplicateEmails.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* File Internal Duplicates */}
          {summary.fileInternalDuplicates.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                Duplicate Emails Within File ({summary.fileInternalDuplicates.length})
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                These emails appeared multiple times in your upload. Only the first occurrence was processed.
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {summary.fileInternalDuplicates.slice(0, 20).map((email, idx) => (
                  <div
                    key={idx}
                    className="text-sm px-3 py-1.5 bg-background rounded border text-muted-foreground font-mono"
                  >
                    {email}
                  </div>
                ))}
                {summary.fileInternalDuplicates.length > 20 && (
                  <p className="text-sm text-muted-foreground italic px-3 py-1">
                    ... and {summary.fileInternalDuplicates.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
