import { useQuery } from "@tanstack/react-query";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity } from "@shared/schema";

export default function ActivityPage() {
  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activity"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Activity Feed</h1>
        <p className="text-muted-foreground">
          Track recent price changes and updates on your wishlist items
        </p>
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
