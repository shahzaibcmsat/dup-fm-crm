import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, Upload, Settings, Database, Building2, Plus, Package } from "lucide-react";
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
    title: "FMD Dashboard",
    url: "/",
    icon: Home,
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

const inventoryItem = {
  title: "Inventory",
  url: "/inventory",
  icon: Package,
};

export function AppSidebar() {
  const [location] = useLocation();
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const { unreadTotal } = useUnreadEmailCounts();
  const userRole = localStorage.getItem("userRole");

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => {
    if (userRole === "client") {
      // Hide Import and Settings for client users, but show Dashboard (leads)
      return item.title !== "Import" && item.title !== "Settings";
    }
    return true;
  });

  // Show companies section for all users
  const showCompanies = true;

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b-2 border-white/20 bg-gradient-to-br from-green-800 via-green-900 to-green-950 shadow-xl">
        <div className="flex items-center justify-center">
          <div className="bg-white p-2 rounded-xl shadow-lg ring-2 ring-white/30 hover:ring-white/50 transition-all">
            <img src="/fmd-logo.png" alt="FMD" className="h-8 w-auto object-contain" />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {filteredMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sm font-semibold">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMenuItems.map((item) => {
                  const isFMDDashboard = item.title === "FMD Dashboard";
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url} className="text-base py-2.5">
                        <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
                          <div className="relative">
                            <item.icon className="w-5 h-5" />
                            {isFMDDashboard && unreadTotal > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs leading-none rounded-full px-1.5 py-0.5 shadow font-bold">
                                {unreadTotal > 9 ? '9+' : unreadTotal}
                              </span>
                            )}
                          </div>
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showCompanies && (
          <SidebarGroup>
            <div className="flex items-center justify-between px-2 py-1">
              <SidebarGroupLabel className="text-sm font-semibold">FMD Companies</SidebarGroupLabel>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIsAddCompanyOpen(true)}
                data-testid="button-add-company"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {companies.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    No companies yet
                  </div>
                ) : (
                  companies.map((company) => (
                    <SidebarMenuItem key={company.id}>
                      <SidebarMenuButton asChild isActive={location === `/companies/${company.id}`} className="text-base py-2.5">
                        <Link href={`/companies/${company.id}`} data-testid={`link-company-${company.id}`}>
                          <Building2 className="w-5 h-5" />
                          <span className="font-medium">{company.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold">Inventory</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === inventoryItem.url} className="text-base py-2.5">
                  <Link href={inventoryItem.url}>
                    <inventoryItem.icon className="w-5 h-5" />
                    <span className="font-medium">{inventoryItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t bg-fmd-green/5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
          <div className="text-sm text-white font-medium">
            FMD Sales CRM Created by <a href="https://napollo.net/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-white/80 font-semibold hover:underline">Napollo</a>.
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
