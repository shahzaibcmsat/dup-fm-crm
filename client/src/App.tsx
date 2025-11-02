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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/companies/:id" component={CompanyLeads} />
      <Route path="/import" component={Import} />
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
              <header className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-fmd-burgundy to-fmd-burgundy-dark shadow-lg">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="text-white hover:bg-white/20" data-testid="button-sidebar-toggle" />
                  <div className="bg-white px-3 py-1.5 rounded-lg shadow-md">
                    <img src="/fmd-logo.png" alt="FMD Companies" className="h-7 object-contain" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <NotificationBell onNotificationClick={handleNotificationClick} />
                  <div className="text-sm font-bold text-white tracking-wider">FMD COMPANIES SALES CRM</div>
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
