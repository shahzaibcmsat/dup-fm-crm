import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserCog, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

interface MemberPermission {
  id: string;
  userId: string;
  companyIds: string[];
  canSeeInventory: boolean;
  createdAt: string;
  updatedAt: string;
}

export function PermissionManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [canSeeInventory, setCanSeeInventory] = useState(false);

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch companies
  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // Fetch all permissions
  const { data: allPermissions, isLoading: permissionsLoading } = useQuery<MemberPermission[]>({
    queryKey: ["/api/permissions"],
  });

  // Filter out admin users - only show members
  const memberUsers = users?.filter(user => user.role === "member") || [];

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: { userId: string; companyIds: string[]; canSeeInventory: boolean }) => {
      const response = await fetch(`/api/permissions/${data.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyIds: data.companyIds,
          canSeeInventory: data.canSeeInventory,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      toast({
        title: "Success",
        description: "Member permissions updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update permissions",
      });
    },
  });

  // Load permissions when user is selected
  useEffect(() => {
    if (selectedUserId) {
      const userPermissions = allPermissions?.find(p => p.userId === selectedUserId);
      if (userPermissions) {
        setSelectedCompanyIds(userPermissions.companyIds || []);
        setCanSeeInventory(userPermissions.canSeeInventory);
      } else {
        // No permissions set yet - default to empty
        setSelectedCompanyIds([]);
        setCanSeeInventory(false);
      }
    }
  }, [selectedUserId, allPermissions]);

  const handleSavePermissions = () => {
    if (!selectedUserId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a member first",
      });
      return;
    }

    updatePermissionsMutation.mutate({
      userId: selectedUserId,
      companyIds: selectedCompanyIds,
      canSeeInventory,
    });
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanyIds(prev => 
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const selectAllCompanies = () => {
    if (companies) {
      setSelectedCompanyIds(companies.map(c => c.id));
    }
  };

  const clearAllCompanies = () => {
    setSelectedCompanyIds([]);
  };

  if (usersLoading || companiesLoading || permissionsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Member Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (memberUsers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Member Permissions
          </CardTitle>
          <CardDescription>
            Control what each member can access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No members found. Create members first in the User Management section above.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const selectedUser = memberUsers.find(u => u.id === selectedUserId);
  const userPermissions = allPermissions?.find(p => p.userId === selectedUserId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          Member Permissions
        </CardTitle>
        <CardDescription>
          Control which companies and features each member can access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Select Member */}
        <div className="space-y-2">
          <Label htmlFor="member-select">Select Member</Label>
          <select
            id="member-select"
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-base"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">-- Select a member --</option>
            {memberUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && (
          <>
            <div className="rounded-lg border p-3 sm:p-4 bg-muted/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm sm:text-base truncate">{selectedUser?.email}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {userPermissions ? "Permissions configured" : "No permissions set yet"}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllCompanies}
                    className="text-xs sm:text-sm"
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearAllCompanies}
                    className="text-xs sm:text-sm"
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Company Access */}
              <div className="space-y-3 mb-6">
                <Label className="text-sm sm:text-base font-semibold">Company Access</Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Member will only see leads from selected companies
                </p>
                
                {companies && companies.length > 0 ? (
                  <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto border rounded-md p-3">
                    {companies.map((company) => (
                      <div key={company.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`company-${company.id}`}
                          checked={selectedCompanyIds.includes(company.id)}
                          onCheckedChange={() => toggleCompany(company.id)}
                          className="flex-shrink-0"
                        />
                        <Label
                          htmlFor={`company-${company.id}`}
                          className="font-normal cursor-pointer text-sm flex-1 min-w-0 break-words"
                        >
                          {company.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs sm:text-sm">
                      No companies found. Create companies first to assign access.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Inventory Access */}
              <div className="space-y-3">
                <Label className="text-sm sm:text-base font-semibold">Feature Access</Label>
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="inventory-access"
                    checked={canSeeInventory}
                    onCheckedChange={(checked) => setCanSeeInventory(checked === true)}
                    className="flex-shrink-0"
                  />
                  <Label
                    htmlFor="inventory-access"
                    className="font-normal cursor-pointer text-sm flex-1"
                  >
                    Can view Inventory page
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUserId("");
                  setSelectedCompanyIds([]);
                  setCanSeeInventory(false);
                }}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePermissions}
                disabled={updatePermissionsMutation.isPending}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {updatePermissionsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Permissions"
                )}
              </Button>
            </div>

            {/* Current Permissions Summary */}
            {userPermissions && (
              <div className="rounded-lg border p-3 sm:p-4 bg-muted/30">
                <h4 className="font-semibold mb-2 text-xs sm:text-sm">Current Permissions Summary</h4>
                <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                  <p>
                    <strong>Companies:</strong>{" "}
                    {userPermissions.companyIds.length > 0
                      ? `${userPermissions.companyIds.length} selected`
                      : "None"}
                  </p>
                  <p>
                    <strong>Inventory:</strong>{" "}
                    {userPermissions.canSeeInventory ? "Can view" : "Cannot view"}
                  </p>
                  <p className="text-xs">
                    Last updated: {new Date(userPermissions.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
