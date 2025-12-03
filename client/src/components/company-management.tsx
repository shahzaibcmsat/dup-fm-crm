import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export function CompanyManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState("");
  const { toast } = useToast();

  // Fetch companies
  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Add company mutation
  const addCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/companies", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Company added",
        description: "The company has been added successfully.",
      });
      setCompanyName("");
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Edit company mutation
  const editCompanyMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/companies/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: "Company updated",
        description: "The company name has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
      setCompanyName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/companies/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Company deleted",
        description: "The company has been removed successfully.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedCompany(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    addCompanyMutation.mutate(companyName.trim());
  };

  const handleEditCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !companyName.trim()) return;
    editCompanyMutation.mutate({ id: selectedCompany.id, name: companyName.trim() });
  };

  const handleDeleteCompany = () => {
    if (!selectedCompany) return;
    deleteCompanyMutation.mutate(selectedCompany.id);
  };

  const openEditDialog = (company: Company) => {
    setSelectedCompany(company);
    setCompanyName(company.name);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (company: Company) => {
    setSelectedCompany(company);
    setIsDeleteDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Building2 className="w-5 h-5" />
              Company Management
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Manage your companies and organize leads
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setCompanyName("");
              setIsAddDialogOpen(true);
            }}
            className="bg-fmd-green hover:bg-fmd-green-dark w-full sm:w-auto text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Company
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading companies...
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm sm:text-base">No companies yet</p>
            <p className="text-xs sm:text-sm mt-1">Add your first company to get started</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-fmd-green" />
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(company)}
                            disabled={editCompanyMutation.isPending || deleteCompanyMutation.isPending}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(company)}
                            disabled={editCompanyMutation.isPending || deleteCompanyMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {companies.map((company) => (
                <div key={company.id} className="border rounded-lg p-3 sm:p-4 space-y-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-fmd-green flex-shrink-0" />
                        <p className="font-medium text-sm truncate">{company.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(company.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(company)}
                      disabled={editCompanyMutation.isPending || deleteCompanyMutation.isPending}
                      className="flex-1 text-xs sm:text-sm"
                    >
                      <Pencil className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(company)}
                      disabled={editCompanyMutation.isPending || deleteCompanyMutation.isPending}
                      className="flex-1 text-xs sm:text-sm text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      {/* Add Company Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Add New Company</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Add a new company to organize your leads
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCompany}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-company-name" className="text-sm sm:text-base">Company Name</Label>
                <Input
                  id="add-company-name"
                  placeholder="Enter company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-10 sm:h-11 text-base"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setCompanyName("");
                }}
                disabled={addCompanyMutation.isPending}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!companyName.trim() || addCompanyMutation.isPending}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {addCompanyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Company"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Edit Company</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update the company name
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCompany}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-company-name" className="text-sm sm:text-base">Company Name</Label>
                <Input
                  id="edit-company-name"
                  placeholder="Enter company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-10 sm:h-11 text-base"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedCompany(null);
                  setCompanyName("");
                }}
                disabled={editCompanyMutation.isPending}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!companyName.trim() || editCompanyMutation.isPending}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {editCompanyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Company"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              This will permanently delete <span className="font-semibold">{selectedCompany?.name}</span>.
              All leads associated with this company will have their company assignment removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedCompany(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
              disabled={deleteCompanyMutation.isPending}
            >
              {deleteCompanyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Company"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
