import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Activity } from "@shared/schema";

export default function ActivityPage() {
  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activity"],
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/items/import-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to import CSV');
      
      const result = await response.json();
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
      
      toast({
        title: "Import successful",
        description: `Imported ${result.imported} items. ${result.failed > 0 ? `Failed: ${result.failed}` : ''}`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to import CSV file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Activity Feed</h1>
          <p className="text-muted-foreground">
            Track recent price changes and updates on your wishlist items
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <ActivityFeed activities={activities} />
      )}
    </div>
  );
}
