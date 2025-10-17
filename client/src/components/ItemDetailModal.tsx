import { useState } from "react";
import { ExternalLink, Search, TrendingUp, TrendingDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { Item, PriceHistory } from "@shared/schema";

interface ItemDetailModalProps {
  item: Item | null;
  priceHistory: PriceHistory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: Item) => void;
  onImageSearch: (imageUrl: string) => void;
}

export function ItemDetailModal({
  item,
  priceHistory,
  open,
  onOpenChange,
  onEdit,
  onImageSearch,
}: ItemDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!item) return null;

  const images = Array.isArray(item.images) ? item.images : [];
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  const chartData = priceHistory.map((h) => ({
    date: format(new Date(h.checkedAt), 'MMM dd'),
    price: h.price / 100,
  }));

  const maxPrice = Math.max(...priceHistory.map((h) => h.price));
  const minPrice = Math.min(...priceHistory.map((h) => h.price));
  const currentPrice = item.price;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="modal-item-detail">
        <DialogHeader>
          <DialogTitle>Item Details</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Gallery */}
          <div className="space-y-4">
            {images.length > 0 && (
              <>
                <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <img
                    src={images[currentImageIndex]}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    data-testid="img-detail-main"
                  />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === currentImageIndex
                            ? "border-primary"
                            : "border-transparent"
                        }`}
                        data-testid={`button-thumbnail-${idx}`}
                      >
                        <img
                          src={img}
                          alt={`${item.name} ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => images.length > 0 && onImageSearch(images[currentImageIndex])}
              data-testid="button-image-search"
            >
              <Search className="h-4 w-4 mr-2" />
              Find Similar Products
            </Button>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2" data-testid="text-detail-name">{item.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="link-product-url"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Product
                </a>
                {!item.inStock && (
                  <Badge variant="secondary" data-testid="badge-detail-out-of-stock">Out of Stock</Badge>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                <p className="text-3xl font-mono font-bold text-primary" data-testid="text-detail-price">
                  {formatCurrency(currentPrice, item.currency)}
                </p>
              </div>

              {item.size && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Selected Size</p>
                  <Badge variant="outline" className="text-sm" data-testid="badge-detail-size">{item.size}</Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Price History */}
            <div className="space-y-3">
              <h3 className="font-semibold">Price History (Last 3 Months)</h3>
              
              {priceHistory.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Highest Price</p>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-alert" />
                        <p className="font-mono font-semibold" data-testid="text-max-price">
                          {formatCurrency(maxPrice, item.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Lowest Price</p>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-success" />
                        <p className="font-mono font-semibold" data-testid="text-min-price">
                          {formatCurrency(minPrice, item.currency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.5rem',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No price history available yet</p>
              )}
            </div>

            <Button
              onClick={() => {
                onEdit(item);
                onOpenChange(false);
              }}
              className="w-full"
              data-testid="button-edit-item"
            >
              Edit Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
