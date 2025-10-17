import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Activity } from "@shared/schema";

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount / 100);
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No price changes yet. Add items to start tracking!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.slice(0, 10).map((activity) => (
        <Card
          key={activity.id}
          className="p-4 hover-elevate transition-all duration-200"
          data-testid={`activity-${activity.id}`}
        >
          <div className="flex items-center gap-4">
            <img
              src={activity.itemImage}
              alt={activity.itemName}
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
              data-testid={`img-activity-${activity.id}`}
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate mb-1" data-testid={`text-activity-name-${activity.id}`}>
                {activity.itemName}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={activity.changeType === 'decrease' ? 'default' : 'destructive'}
                  className={`text-xs ${
                    activity.changeType === 'decrease'
                      ? 'bg-success text-success-foreground border-success-border'
                      : 'bg-alert text-alert-foreground border-alert-border'
                  }`}
                  data-testid={`badge-change-${activity.id}`}
                >
                  {activity.changeType === 'decrease' ? (
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                  )}
                  {activity.changeType === 'decrease' ? 'Price Drop' : 'Price Rise'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(activity.oldPrice, activity.currency)} →{' '}
                  {formatCurrency(activity.newPrice, activity.currency)}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right flex-shrink-0">
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
