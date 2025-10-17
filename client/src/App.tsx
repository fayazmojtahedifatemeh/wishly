import { useState } from "react";
import { Switch, Route } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { AddItemModal } from "@/components/AddItemModal";
import { AddListModal } from "@/components/AddListModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ActivityPage from "@/pages/ActivityPage";
import ListPage from "@/pages/ListPage";
import GoalsPage from "@/pages/GoalsPage";
import NotFound from "@/pages/not-found";
import type { List } from "@shared/schema";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ActivityPage} />
      <Route path="/lists/:id" component={ListPage} />
      <Route path="/goals" component={GoalsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [addListModalOpen, setAddListModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: lists = [] } = useQuery<List[]>({
    queryKey: ["/api/lists"],
  });

  const { data: items = [] } = useQuery({
    queryKey: ["/api/items"],
  });

  const addItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      toast({ title: "Item added successfully" });
    },
  });

  const addListMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/lists", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
      toast({ title: "List created successfully" });
    },
  });

  // Calculate item counts per list
  const itemCounts = lists.reduce((acc, list) => {
    const count = items.filter((item: any) => {
      const itemLists = Array.isArray(item.lists) ? item.lists : [];
      return list.id === "all" || itemLists.includes(list.id);
    }).length;
    acc[list.id] = count;
    return acc;
  }, {} as Record<string, number>);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar
          lists={lists}
          itemCounts={itemCounts}
          onAddList={() => setAddListModalOpen(true)}
        />
        
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background px-6 py-3">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          
          <main className="flex-1 overflow-auto p-6">
            <Router />
          </main>

          {/* Floating Add Button */}
          <Button
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-50"
            onClick={() => setAddItemModalOpen(true)}
            data-testid="button-add-item-fab"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </SidebarInset>
      </div>

      <AddItemModal
        open={addItemModalOpen}
        onOpenChange={setAddItemModalOpen}
        lists={lists}
        onAddItem={(data) => addItemMutation.mutateAsync(data)}
      />

      <AddListModal
        open={addListModalOpen}
        onOpenChange={setAddListModalOpen}
        onAdd={(name) => addListMutation.mutateAsync(name)}
      />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
