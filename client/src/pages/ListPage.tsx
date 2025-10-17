import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ItemCard } from "@/components/ItemCard";
import { ItemDetailModal } from "@/components/ItemDetailModal";
import { EditItemModal } from "@/components/EditItemModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Item, List, PriceHistory } from "@shared/schema";

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
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
    const itemLists = Array.isArray(item.lists) ? item.lists : [];
    return id === "all" || itemLists.includes(id!);
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => apiRequest("DELETE", `/api/items/${itemId}`),
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
    
    try {
      const response = await fetch(`/api/items/${selectedItem.id}/reverse-image`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const { searchUrl } = await response.json();
        window.open(searchUrl, '_blank');
      } else {
        const fallbackUrl = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`;
        window.open(fallbackUrl, '_blank');
      }
    } catch (error) {
      console.error('Error with reverse image search:', error);
      const fallbackUrl = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`;
      window.open(fallbackUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {list?.name || "All Items"}
        </h1>
        <p className="text-muted-foreground">
          {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
    </div>
  );
}
