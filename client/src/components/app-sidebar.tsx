import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, Upload, Settings, Database, Building2, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Company } from "@shared/schema";
import { AddCompanyDialog } from "@/components/add-company-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useUnreadEmailCounts } from "@/lib/notificationStore";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "All Leads",
    url: "/leads",
    icon: Database,
  },
  {
    title: "Import",
    url: "/import",
    icon: Upload,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const { unreadTotal } = useUnreadEmailCounts();

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b-2 border-white/20 bg-gradient-to-br from-fmd-burgundy via-fmd-burgundy-dark to-fmd-black shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2.5 rounded-xl shadow-lg ring-2 ring-white/30 hover:ring-white/50 transition-all">
            <img src="/fmd-logo.png" alt="FMD" className="h-12 w-auto object-contain" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-black text-white tracking-tight leading-tight drop-shadow-md">FMD COMPANIES</h1>
            <p className="text-sm text-white/90 font-semibold tracking-wide">Sales CRM System</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isLeads = item.title === "All Leads";
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
                        <div className="relative">
                          <item.icon className="w-4 h-4" />
                          {isLeads && unreadTotal > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none rounded-full px-1.5 py-0.5 shadow">
                              {unreadTotal > 9 ? '9+' : unreadTotal}
                            </span>
                          )}
                        </div>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div className="flex items-center justify-between px-2 py-1">
            <SidebarGroupLabel>Companies</SidebarGroupLabel>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setIsAddCompanyOpen(true)}
              data-testid="button-add-company"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {companies.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  No companies yet
                </div>
              ) : (
                companies.map((company) => (
                  <SidebarMenuItem key={company.id}>
                    <SidebarMenuButton asChild isActive={location === `/companies/${company.id}`}>
                      <Link href={`/companies/${company.id}`} data-testid={`link-company-${company.id}`}>
                        <Building2 className="w-4 h-4" />
                        <span>{company.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t bg-fmd-green/5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></div>
          <div className="text-xs text-white font-medium">
            FMD Sales CRM Created by <a href="https://napollo.net/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 font-semibold hover:underline">Napollo</a>.
          </div>
        </div>
      </SidebarFooter>

      <AddCompanyDialog 
        isOpen={isAddCompanyOpen} 
        onClose={() => setIsAddCompanyOpen(false)} 
      />
    </Sidebar>
  );
}
