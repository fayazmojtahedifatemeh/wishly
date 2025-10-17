import { useState } from "react";
import { ExternalLink, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Item } from "@shared/schema";

interface ItemCardProps {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onClick: (item: Item) => void;
}

export function ItemCard({ item, onEdit, onDelete, onClick }: ItemCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = Array.isArray(item.images) ? item.images : [];

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  return (
    <Card
      className={`group overflow-hidden hover-elevate transition-all duration-200 cursor-pointer ${
        !item.inStock ? 'opacity-60' : ''
      }`}
      onClick={() => onClick(item)}
      data-testid={`card-item-${item.id}`}
    >
      {/* Image Section */}
      <div className="relative aspect-[3/4]">
        {images.length > 0 && (
          <>
            <img
              src={images[currentImageIndex]}
              alt={item.name}
              className="w-full h-full object-cover"
              data-testid={`img-item-${item.id}`}
            />
            {/* Image dots */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      idx === currentImageIndex
                        ? "bg-white w-4"
                        : "bg-white/60"
                    }`}
                    data-testid={`button-image-dot-${item.id}-${idx}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Quick Actions */}
        <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                data-testid={`button-menu-${item.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                data-testid={`button-edit-${item.id}`}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(item.url, '_blank');
                }}
                data-testid={`button-open-link-${item.id}`}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="text-destructive"
                data-testid={`button-delete-${item.id}`}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stock Status */}
        {!item.inStock && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <Badge variant="secondary" className="text-sm" data-testid={`badge-out-of-stock-${item.id}`}>
              Out of Stock
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2" data-testid={`text-item-name-${item.id}`}>
          {item.name}
        </h3>
        
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-mono font-semibold text-primary" data-testid={`text-item-price-${item.id}`}>
            {formatCurrency(item.price, item.currency)}
          </p>
          {item.size && (
            <Badge variant="outline" className="text-xs" data-testid={`badge-size-${item.id}`}>
              {item.size}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
