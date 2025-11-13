import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { useEmailNotifications } from "@/hooks/use-email-notifications";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Import from "@/pages/import";
import Settings from "@/pages/settings";
import CompanyLeads from "@/pages/company-leads";
import Inventory from "@/pages/inventory";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/companies/:id" component={CompanyLeads} />
      <Route path="/import" component={Import} />
      <Route path="/inventory" component={Inventory} />
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

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    // Clear notification data on logout
    localStorage.removeItem("fmd-email-notifications");
    localStorage.removeItem("fmd-shown-notifications");
    navigate("/login");
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
  const [location] = useLocation();
  const isAuthenticated = localStorage.getItem("userRole");

  // If on login page, show login without sidebar/header
  if (location === "/login") {
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
    window.location.href = "/login";
    return null;
  }

  return <AuthenticatedApp />;
}
