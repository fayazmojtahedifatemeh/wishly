// In file: client/src/components/AddItemModal.tsx

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles, Camera, Plus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast"; // --- ADDED: For error pop-ups ---

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

interface ImageSearchResult {
  name: string;
  price: string;
  url: string;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState<
    ImageSearchResult[]
  >([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast(); // --- ADDED: For error pop-ups ---

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
    },
  });

  // --- UPGRADED with error handling ---
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setImageSearchResults([]);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/items/analyze-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // This will grab the error message from the server and show it
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze image");
      }

      const data = await response.json();
      if (!data.products || data.products.length === 0) {
        throw new Error("AI could not find any products for this image.");
      }

      setImageSearchResults(data.products);
    } catch (error: any) {
      // --- ADDED: This will show the error in a pop-up ---
      toast({
        title: "Image Search Failed",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
      console.error("Error analyzing image:", error);
    } finally {
      setIsAnalyzing(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

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
    } catch (error: any) {
      toast({
        // --- ADDED: Error handling for URL fetching ---
        title: "Fetch Failed",
        description: error.message || "Could not fetch details for this URL.",
        variant: "destructive",
      });
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
    } catch (error: any) {
      toast({
        // --- ADDED: Error handling for item add ---
        title: "Error Adding Item",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
      console.error("Error adding item:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="modal-add-item"
      >
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
          <DialogDescription>
            Enter the product URL or search by image to add to your wishlist
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
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://example.com/product"
                          {...field}
                          data-testid="input-product-url"
                          className="flex-1"
                        />
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={isAnalyzing}
                          title="Search by image"
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />

                    {/* This block displays the search results */}
                    {imageSearchResults.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <p className="text-sm font-medium">
                          Image Search Results:
                        </p>
                        <div className="max-h-60 overflow-y-auto space-y-2 rounded-md border p-2">
                          {imageSearchResults.map((product, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted"
                            >
                              <div className="flex-1 overflow-hidden">
                                <p
                                  className="text-sm font-medium truncate"
                                  title={product.name}
                                >
                                  {product.name}
                                </p>
                                <p className="text-sm text-primary">
                                  {product.price}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  form.setValue("url", product.url);
                                  setImageSearchResults([]);
                                }}
                                title="Use this URL"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                <h3
                  className="font-semibold text-lg mb-1"
                  data-testid="text-product-name"
                >
                  {preview.name}
                </h3>
                <p
                  className="text-2xl font-mono font-semibold text-primary"
                  data-testid="text-product-price"
                >
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: preview.currency,
                  }).format(preview.price / 100)}
                </p>
              </div>

              {/* Size Selection */}
              {preview.availableSizes.length > 0 && (
                <div>
                  <Label>Size</Label>
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger data-testid="select-size">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {preview.availableSizes.map((size) => (
                        <SelectItem
                          key={size}
                          value={size}
                          data-testid={`option-size-${size}`}
                        >
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* List Selection */}
              <div>
                <Label className="mb-3 flex items-center gap-2">
                  Add to Lists
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Suggested
                  </Badge>
                </Label>
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
                              : selectedLists.filter((id) => id !== list.id),
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
