import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, Key, Shield, Trash2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";

interface User {
  id: string;
  email: string;
  role: string;
  canSeeInventory?: boolean;
  created_at: string;
  email_confirmed_at?: string;
}

export function UserManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [autoConfirm, setAutoConfirm] = useState(true);
  const { toast } = useToast();
  const { user: currentUser, refreshUserMetadata } = useAuth();

  // Fetch users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; password: string; role: string; autoConfirm: boolean }) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create user');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "User created",
        description: "User has been created successfully",
      });
      setIsDialogOpen(false);
      setEmail("");
      setPassword("");
      setRole("member");
      setAutoConfirm(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete user');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "User deleted",
        description: "User has been removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle inventory access mutation
  const toggleInventoryMutation = useMutation({
    mutationFn: async ({ userId, canSeeInventory }: { userId: string; canSeeInventory: boolean }) => {
      const res = await fetch(`/api/users/${userId}/inventory-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canSeeInventory }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update inventory access');
      }
      
      return res.json();
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      // If the user being updated is the currently logged-in user, refresh their auth state
      if (currentUser && currentUser.id === variables.userId) {
        console.log('🔄 Refreshing current user metadata after inventory access change...');
        await refreshUserMetadata();
      }
      
      toast({
        title: "Access updated",
        description: "Inventory access updated successfully. Changes applied immediately.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!email || !password) {
      toast({
        title: "Validation error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Validation error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({ email, password, role, autoConfirm });
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user accounts and access levels
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Create New User</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Add a new user to the system with specified role and credentials
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 sm:space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm sm:text-base">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 sm:h-11 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2 text-sm sm:text-base">
                    <Key className="w-4 h-4" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 sm:h-11 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="flex items-center gap-2 text-sm sm:text-base">
                    <Shield className="w-4 h-4" />
                    Role
                  </Label>
                  <Select value={role} onValueChange={(value: "admin" | "member") => setRole(value)}>
                    <SelectTrigger className="h-10 sm:h-11 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          <span>Admin - Full Access</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="member">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          <span>Member - Limited Access</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {role === "admin" 
                      ? "Admin has full access to all features including Settings and Import"
                      : "Member can view and manage leads but cannot access Settings or Import"}
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label htmlFor="auto-confirm" className="flex items-center gap-2 text-sm sm:text-base">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Auto-confirm user</span>
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Skip email verification (user can login immediately)
                    </p>
                  </div>
                  <Switch
                    id="auto-confirm"
                    checked={autoConfirm}
                    onCheckedChange={setAutoConfirm}
                    className="flex-shrink-0"
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No users found
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Inventory Access</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role === "admin" ? "Admin" : "Member"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={(user as any).canSeeInventory || false}
                          onCheckedChange={(checked) => {
                            toggleInventoryMutation.mutate({
                              userId: user.id,
                              canSeeInventory: checked
                            });
                          }}
                          disabled={user.role === "admin" || toggleInventoryMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        {user.email_confirmed_at ? (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deleteUserMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4 space-y-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <p className="font-medium text-sm truncate">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                          {user.role === "admin" ? "Admin" : "Member"}
                        </Badge>
                        {user.email_confirmed_at ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pending</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={deleteUserMutation.isPending}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Inventory Access</Label>
                      <Switch
                        checked={(user as any).canSeeInventory || false}
                        onCheckedChange={(checked) => {
                          toggleInventoryMutation.mutate({
                            userId: user.id,
                            canSeeInventory: checked
                          });
                        }}
                        disabled={user.role === "admin" || toggleInventoryMutation.isPending}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-xs font-medium">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
