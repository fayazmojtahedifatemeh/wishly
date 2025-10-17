// In file: client/src/pages/ListPage.tsx (REPLACE THE WHOLE FILE)

import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ItemCard } from "@/components/ItemCard";
import { ItemDetailModal } from "@/components/ItemDetailModal";
import { EditItemModal } from "@/components/EditItemModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { Item, List, PriceHistory } from "@shared/schema";

export default function ListPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [lensSheetOpen, setLensSheetOpen] = useState(false);
  const [lensResults, setLensResults] = useState<any[]>([]);
  const [lensLoading, setLensLoading] = useState(false);
  const { toast } = useToast();

  const { data: list } = useQuery<List>({
    queryKey: ["/api/lists", id],
    enabled: !!id,
  });

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const { data: allLists = [] } = useQuery<List[]>({
    queryKey: ["/api/lists"],
  });

  const { data: priceHistory = [] } = useQuery<PriceHistory[]>({
    queryKey: ["/api/price-history", selectedItem?.id],
    enabled: !!selectedItem?.id,
  });

  const filteredItems = items.filter((item) => {
    // @ts-ignore - Assuming 'lists' is part of your Item type
    const itemLists = Array.isArray(item.lists) ? item.lists : [];
    return id === "all" || itemLists.includes(id!);
  });

  // --- Mutation for updating prices in THIS list ---
  const checkListPricesMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/lists/${id}/check-prices`),
    onMutate: () => {
      toast({ title: `Updating prices for ${list?.name || "this list"}...` });
    },
    // --- THIS onSuccess BLOCK IS NOW CORRECTED ---
    onSuccess: (data: any) => {
      console.log(`List ${id} price check response:`, data); // For debugging
      const successCount = data?.successCount ?? 0; // Safely get count
      const failCount = data?.failCount ?? 0; // Safely get count

      queryClient.invalidateQueries({ queryKey: ["/api/items"] }); // Refresh items
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] }); // Refresh activity
      toast({
        title: "List Update Complete!",
        description: `${successCount} items updated, ${failCount} failed.`, // Use safe counts
      });
    },
    // --- END OF CORRECTION ---
    onError: (error: any) => {
      toast({
        title: "List Update Failed",
        description: error?.message || "Could not update prices for this list.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiRequest("DELETE", `/api/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Item deleted successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) =>
      apiRequest("PATCH", `/api/items/${itemId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Item updated successfully" });
    },
  });

  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
  };

  const handleEditClick = (item: Item) => {
    setEditingItem(item);
    setEditModalOpen(true);
  };

  const handleImageSearch = async (imageUrl: string) => {
    if (!selectedItem) return;
    
    setLensSheetOpen(true);
    setLensLoading(true);
    setLensResults([]);
    
    try {
      const response = await fetch(
        `/api/items/${selectedItem.id}/google-lens`,
        { method: "POST" },
      );
      
      if (response.ok) {
        const { products } = await response.json();
        setLensResults(products || []);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to search");
      }
    } catch (error: any) {
      console.error("Error with Google Lens search:", error);
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search with Google Lens. Please try again.",
        variant: "destructive",
      });
      setLensSheetOpen(false);
    } finally {
      setLensLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section with Refresh Button */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">
            {list?.name || "All Items"}
          </h1>
          <p className="text-muted-foreground">
            {filteredItems.length}{" "}
            {filteredItems.length === 1 ? "item" : "items"}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => checkListPricesMutation.mutate()}
          disabled={checkListPricesMutation.isPending}
          title={`Refresh prices in ${list?.name || "this list"}`}
        >
          <RefreshCw
            className={`h-4 w-4 ${checkListPricesMutation.isPending ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {/* Item Grid or Loading/Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No items in this list yet. Add some items to get started!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={handleEditClick}
              onDelete={(id) => deleteMutation.mutate(id)}
              onClick={handleItemClick}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <ItemDetailModal
        item={selectedItem}
        priceHistory={priceHistory}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onEdit={handleEditClick}
        onImageSearch={handleImageSearch}
      />
      <EditItemModal
        item={editingItem}
        lists={allLists}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={(itemId, data) => updateMutation.mutateAsync({ itemId, data })}
      />

      {/* Google Lens Results Sheet */}
      <Sheet open={lensSheetOpen} onOpenChange={setLensSheetOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Similar Products Found</SheetTitle>
            <SheetDescription>
              Results from Google Lens analysis of your item
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 overflow-y-auto h-[calc(80vh-120px)]">
            {lensLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Searching with Google Lens...</p>
              </div>
            ) : lensResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No similar products found</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {lensResults.map((product, idx) => (
                  <a
                    key={idx}
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block p-4 border rounded-lg hover:border-primary transition-colors"
                    data-testid={`link-lens-result-${idx}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2 mb-2">
                          {product.name}
                        </h3>
                        <Badge variant="secondary" className="mb-2">
                          {product.price}
                        </Badge>
                        <p className="text-xs text-muted-foreground truncate">
                          {new URL(product.url).hostname}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
