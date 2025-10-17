import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ExternalLink, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { List } from "@shared/schema";

const formSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

interface ProductPreview {
  name: string;
  images: string[];
  price: number;
  currency: string;
  availableSizes: string[];
  suggestedLists: string[];
}

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: List[];
  onAddItem: (data: {
    url: string;
    selectedSize?: string;
    selectedLists: string[];
  }) => Promise<void>;
}

export function AddItemModal({
  open,
  onOpenChange,
  lists,
  onAddItem,
}: AddItemModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<ProductPreview | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>();
  const [selectedLists, setSelectedLists] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
    },
  });

  const handleFetchProduct = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/items/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: values.url }),
      });
      
      if (!response.ok) throw new Error("Failed to fetch product");
      
      const data: ProductPreview = await response.json();
      setPreview(data);
      setSelectedLists(data.suggestedLists);
      if (data.availableSizes.length > 0) {
        setSelectedSize(data.availableSizes[0]);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!preview) return;
    
    setIsLoading(true);
    try {
      await onAddItem({
        url: form.getValues("url"),
        selectedSize,
        selectedLists,
      });
      
      // Reset form
      form.reset();
      setPreview(null);
      setSelectedLists([]);
      setSelectedSize(undefined);
      setCurrentImageIndex(0);
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding item:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-add-item">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
          <DialogDescription>
            Enter the product URL to fetch details and add to your wishlist
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <Form {...form}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/product"
                        {...field}
                        data-testid="input-product-url"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="button" 
                onClick={form.handleSubmit(handleFetchProduct)} 
                disabled={isLoading} 
                className="w-full" 
                data-testid="button-fetch-product"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching product details...
                  </>
                ) : (
                  "Fetch Product"
                )}
              </Button>
            </div>
          </Form>
        ) : (
          <div className="space-y-6">
            {/* Image Carousel */}
            <div className="relative">
              <img
                src={preview.images[currentImageIndex]}
                alt={preview.name}
                className="w-full h-64 object-cover rounded-xl"
                data-testid="img-product-preview"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {preview.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentImageIndex
                        ? "bg-primary w-6"
                        : "bg-white/50"
                    }`}
                    data-testid={`button-image-dot-${idx}`}
                  />
                ))}
              </div>
            </div>

            {/* Product Details */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1" data-testid="text-product-name">{preview.name}</h3>
                <p className="text-2xl font-mono font-semibold text-primary" data-testid="text-product-price">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: preview.currency,
                  }).format(preview.price / 100)}
                </p>
              </div>

              {/* Size Selection */}
              {preview.availableSizes.length > 0 && (
                <div>
                  <FormLabel>Size</FormLabel>
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger data-testid="select-size">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {preview.availableSizes.map((size) => (
                        <SelectItem key={size} value={size} data-testid={`option-size-${size}`}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* List Selection */}
              <div>
                <FormLabel className="mb-3 flex items-center gap-2">
                  Add to Lists
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Suggested
                  </Badge>
                </FormLabel>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {lists.map((list) => (
                    <div key={list.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={list.id}
                        checked={selectedLists.includes(list.id)}
                        onCheckedChange={(checked) => {
                          setSelectedLists(
                            checked
                              ? [...selectedLists, list.id]
                              : selectedLists.filter((id) => id !== list.id)
                          );
                        }}
                        data-testid={`checkbox-list-${list.id}`}
                      />
                      <label
                        htmlFor={list.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {list.name}
                        {preview.suggestedLists.includes(list.id) && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Suggested
                          </Badge>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreview(null);
                    setCurrentImageIndex(0);
                  }}
                  className="flex-1"
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button
                  onClick={handleAddItem}
                  disabled={isLoading || selectedLists.length === 0}
                  className="flex-1"
                  data-testid="button-add-to-wishlist"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add to Wishlist"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
