import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { GoalCard } from "@/components/GoalCard";
import { AddGoalModal } from "@/components/AddGoalModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Goal } from "@shared/schema";

export default function GoalsPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal created successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal deleted successfully" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Goals</h1>
          <p className="text-muted-foreground">
            Set and track your wishlist savings goals
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} data-testid="button-add-goal">
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No goals yet. Create your first goal to start tracking!
          </p>
          <Button onClick={() => setAddModalOpen(true)} data-testid="button-add-first-goal">
            <Plus className="h-4 w-4 mr-2" />
            Create Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      <AddGoalModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAdd={(data) => addMutation.mutateAsync(data)}
      />
    </div>
  );
}
