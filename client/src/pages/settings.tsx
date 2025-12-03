import React from "react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, Server, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { UserManagement } from "@/components/user-management";
import { CompanyManagement } from "@/components/company-management";
import { PermissionManagement } from "@/components/permission-management";
import { useAuth } from "@/hooks/use-auth";

interface ConfigData {
  GMAIL_CLIENT_ID: string;
  GMAIL_CLIENT_SECRET: string;
  EMAIL_FROM_ADDRESS: string;
  GROQ_API_KEY: string;
}

export default function Settings() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfigData>({
    GMAIL_CLIENT_ID: '',
    GMAIL_CLIENT_SECRET: '',
    EMAIL_FROM_ADDRESS: '',
    GROQ_API_KEY: '',
  });
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();
  
  // Only admins can access settings
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

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error("Failed to load configuration", e);
      toast({
        title: "Error",
        description: "Failed to load configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearNotifications = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/notifications/clear", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      
      // Invalidate notifications so UI refreshes immediately
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/emails'] });
      
      toast({
        title: "Notifications cleared",
        description: data?.message || "All notifications have been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to clear notifications",
        description: error?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-2">Settings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage users, companies, permissions, and view connection status
          </p>
        </div>
        <Button 
          onClick={handleClearNotifications} 
          disabled={clearing} 
          variant="destructive" 
          className="text-sm sm:text-base"
        >
          <BellOff className="w-4 h-4 mr-2" />
          {clearing ? "Clearing..." : "Clear Notifications"}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* User Management */}
          <UserManagement />

          {/* Permission Management */}
          <PermissionManagement />

          {/* Company Management */}
          <CompanyManagement />

          {/* Connected Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Connection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm sm:text-base">Gmail</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {config.EMAIL_FROM_ADDRESS || "Not configured"}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant={config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET ? "default" : "secondary"} 
                  className="gap-1 flex-shrink-0 text-xs sm:text-sm"
                >
                  {config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Connected</span>
                      <span className="sm:hidden">✓</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Not Connected</span>
                      <span className="sm:hidden">✗</span>
                    </>
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Server className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm sm:text-base">Groq AI</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Grammar checking enabled</p>
                  </div>
                </div>
                <Badge 
                  variant={config.GROQ_API_KEY ? "default" : "secondary"} 
                  className="gap-1 flex-shrink-0 text-xs sm:text-sm"
                >
                  {config.GROQ_API_KEY ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Connected</span>
                      <span className="sm:hidden">✓</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Not Connected</span>
                      <span className="sm:hidden">✗</span>
                    </>
                  )}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Lead Statuses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Lead Statuses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="text-xs sm:text-sm">NEW</Badge>
                <Badge variant="secondary" className="text-xs sm:text-sm">CONTACTED</Badge>
                <Badge variant="outline" className="text-xs sm:text-sm">QUALIFIED</Badge>
                <Badge variant="secondary" className="text-xs sm:text-sm">FOLLOW-UP</Badge>
                <Badge variant="default" className="text-xs sm:text-sm">CLOSED WON</Badge>
                <Badge variant="outline" className="text-xs sm:text-sm">CLOSED LOST</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
