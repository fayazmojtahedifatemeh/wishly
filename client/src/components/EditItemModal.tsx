import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Item, List } from "@shared/schema";

const formSchema = z.object({
  size: z.string().optional(),
  lists: z.array(z.string()).min(1, "Select at least one list"),
});

interface EditItemModalProps {
  item: Item | null;
  lists: List[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (itemId: string, data: { size?: string; lists: string[] }) => Promise<void>;
}

export function EditItemModal({
  item,
  lists,
  open,
  onOpenChange,
  onSave,
}: EditItemModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      size: item?.size || "",
      lists: Array.isArray(item?.lists) ? item.lists : [],
    },
  });

  useEffect(() => {
    if (item) {
      const sizes = Array.isArray(item.availableSizes) ? item.availableSizes : [];
      setAvailableSizes(sizes);
      form.reset({
        size: item.size || "",
        lists: Array.isArray(item.lists) ? item.lists : [],
      });
    }
  }, [item, form]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!item) return;

    setIsLoading(true);
    try {
      await onSave(item.id, values);
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating item:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null;

  const selectedLists = form.watch("lists");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="modal-edit-item">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>Update item details and list assignments</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Size Selection */}
            {availableSizes.length > 0 && (
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-size">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableSizes.map((size) => {
                          const isAvailable = true; // In real app, check availability from API
                          return (
                            <SelectItem
                              key={size}
                              value={size}
                              disabled={!isAvailable}
                              data-testid={`option-edit-size-${size}`}
                            >
                              <div className="flex items-center gap-2">
                                {size}
                                {!isAvailable && (
                                  <Badge variant="outline" className="text-xs">
                                    Not Available
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* List Selection */}
            <FormField
              control={form.control}
              name="lists"
              render={() => (
                <FormItem>
                  <FormLabel>Lists</FormLabel>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {lists.map((list) => (
                      <FormField
                        key={list.id}
                        control={form.control}
                        name="lists"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(list.id)}
                                onCheckedChange={(checked) => {
                                  const newValue = checked
                                    ? [...(field.value || []), list.id]
                                    : field.value?.filter((id) => id !== list.id) || [];
                                  field.onChange(newValue);
                                }}
                                data-testid={`checkbox-edit-list-${list.id}`}
                              />
                            </FormControl>
                            <label
                              htmlFor={list.id}
                              className="text-sm font-medium leading-none cursor-pointer flex-1"
                            >
                              {list.name}
                            </label>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
                data-testid="button-save-edit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
