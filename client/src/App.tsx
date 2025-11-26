import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { useEmailNotifications } from "@/hooks/use-email-notifications";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Import from "@/pages/import";
import Settings from "@/pages/settings";
import CompanyLeads from "@/pages/company-leads";
const Inventory = React.lazy(() => import("@/pages/inventory"));
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/companies/:id" component={CompanyLeads} />
      <Route path="/import" component={Import} />
      <Route path="/inventory">
        {() => (
          <React.Suspense fallback={
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading Inventory...</p>
              </div>
            </div>
          }>
            <Inventory />
          </React.Suspense>
        )}
      </Route>
      <Route path="/settings" component={Settings} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  // Enable email reply notifications
  useEmailNotifications();
  const [, navigate] = useLocation();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const handleNotificationClick = (leadId: string) => {
    navigate(`/leads?selected=${leadId}`);
  };

  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 border-b-2 border-white/20 bg-gradient-to-br from-green-800 via-green-900 to-green-950 shadow-xl">
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  <SidebarTrigger className="text-white hover:bg-white/20 flex-shrink-0" data-testid="button-sidebar-toggle" />
                  <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight truncate">
                    FMD Companies Dashboard
                  </h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  <NotificationBell onNotificationClick={handleNotificationClick} />
                  {user && (
                    <div className="hidden md:flex items-center gap-2 text-white/90 text-sm px-3 py-1.5 bg-white/10 rounded-md">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{user.email}</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-white hover:bg-white/20 flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              </header>
              <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                <div className="max-w-7xl mx-auto">
                  <Router />
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-fmd-green to-green-700">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // If on login page, show login without sidebar/header
  if (location === "/login") {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated) {
      navigate("/");
      return null;
    }
    
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Login />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // If not authenticated and not on login page, redirect to login
  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return <AuthenticatedApp />;
}
