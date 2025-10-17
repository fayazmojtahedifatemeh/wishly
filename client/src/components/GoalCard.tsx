import { Target, Calendar, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import type { Goal } from "@shared/schema";

interface GoalCardProps {
  goal: Goal;
  onDelete: (id: string) => void;
}

export function GoalCard({ goal, onDelete }: GoalCardProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  const progress = (goal.currentAmount / goal.targetAmount) * 100;
  const itemCount = Array.isArray(goal.itemIds) ? goal.itemIds.length : 0;

  return (
    <Card className="p-6 space-y-4 hover-elevate transition-all" data-testid={`card-goal-${goal.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-1" data-testid={`text-goal-title-${goal.id}`}>
            {goal.title}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              <span>{itemCount} items</span>
            </div>
            {goal.deadline && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(goal.deadline), 'MMM dd, yyyy')}</span>
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(goal.id)}
          data-testid={`button-delete-goal-${goal.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-mono font-semibold" data-testid={`text-goal-progress-${goal.id}`}>
            {formatCurrency(goal.currentAmount, goal.currency)} / {formatCurrency(goal.targetAmount, goal.currency)}
          </span>
        </div>
        <Progress value={progress} className="h-2" data-testid={`progress-goal-${goal.id}`} />
        <p className="text-xs text-muted-foreground text-right">
          {progress.toFixed(0)}% Complete
        </p>
      </div>
    </Card>
  );
}
