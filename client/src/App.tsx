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
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Import from "@/pages/import";
import Settings from "@/pages/settings";
import CompanyLeads from "@/pages/company-leads";
import Inventory from "@/pages/inventory";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/companies/:id" component={CompanyLeads} />
      <Route path="/import" component={Import} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between px-4 py-4 border-b-2 border-white/20 bg-gradient-to-br from-green-800 via-green-900 to-green-950 shadow-xl">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="text-white hover:bg-white/20" data-testid="button-sidebar-toggle" />
                </div>
                <div className="flex items-center gap-4">
                  <NotificationBell onNotificationClick={handleNotificationClick} />
                </div>
              </header>
              <main className="flex-1 overflow-y-auto p-6">
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
