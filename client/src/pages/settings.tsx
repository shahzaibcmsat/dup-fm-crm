import React from "react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, CheckCircle2, Database, Key, Server, Save, Eye, EyeOff, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { UserManagement } from "@/components/user-management";
import { PermissionManagement } from "@/components/permission-management";
import { useAuth } from "@/hooks/use-auth";

interface ConfigData {
  DATABASE_URL: string;
  GMAIL_CLIENT_ID: string;
  GMAIL_CLIENT_SECRET: string;
  GMAIL_REFRESH_TOKEN: string;
  GMAIL_REDIRECT_URI: string;
  EMAIL_FROM_ADDRESS: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
  PORT: string;
  NODE_ENV: string;
}

export default function Settings() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfigData>({
    DATABASE_URL: '',
    GMAIL_CLIENT_ID: '',
    GMAIL_CLIENT_SECRET: '',
    GMAIL_REFRESH_TOKEN: '',
    GMAIL_REDIRECT_URI: '',
    EMAIL_FROM_ADDRESS: '',
    GROQ_API_KEY: '',
    GROQ_MODEL: '',
    PORT: '',
    NODE_ENV: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: "Success",
          description: data.message || "Configuration saved successfully",
        });
      } else {
        toast({
          title: "Error",
          description: data.errors?.join(', ') || data.message || "Failed to save configuration",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

  const handleInputChange = (field: keyof ConfigData, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const renderSecretInput = (field: keyof ConfigData, label: string, placeholder: string, icon?: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={field} className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={field}
          type={showSecrets[field] ? "text" : "password"}
          value={config[field]}
          onChange={(e) => handleInputChange(field, e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => toggleSecretVisibility(field)}
        >
          {showSecrets[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  const renderInput = (field: keyof ConfigData, label: string, placeholder: string, icon?: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={field} className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <Input
        id={field}
        value={config[field]}
        onChange={(e) => handleInputChange(field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-2">Settings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your API keys and environment configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleClearNotifications} 
            disabled={clearing} 
            variant="destructive" 
            className="text-sm sm:text-base"
          >
            <BellOff className="w-4 h-4 mr-2" />
            {clearing ? "Clearing..." : "Clear Notifications"}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="text-sm sm:text-base">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Loading configuration...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* User Management */}
          <UserManagement />
          
          {/* Member Permissions */}
          <PermissionManagement />

          {/* Connected Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Gmail</p>
                    <p className="text-sm text-muted-foreground">
                      {config.EMAIL_FROM_ADDRESS || "Not configured"}
                    </p>
                  </div>
                </div>
                <Badge variant={config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET ? "default" : "secondary"} className="gap-1">
                  {config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </>
                  ) : (
                    "Not Connected"
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Server className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Groq AI</p>
                    <p className="text-sm text-muted-foreground">Grammar checking enabled</p>
                  </div>
                </div>
                <Badge variant={config.GROQ_API_KEY ? "default" : "secondary"} className="gap-1">
                  {config.GROQ_API_KEY ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </>
                  ) : (
                    "Not Connected"
                  )}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Lead Statuses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Statuses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">NEW</Badge>
                <Badge variant="secondary">CONTACTED</Badge>
                <Badge variant="outline">QUALIFIED</Badge>
                <Badge variant="secondary">FOLLOW-UP</Badge>
                <Badge variant="default">CLOSED WON</Badge>
                <Badge variant="outline">CLOSED LOST</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
