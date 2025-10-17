import {
  Home,
  ListTodo,
  Target,
  Plus,
  Shirt,
  ShoppingBag,
  Utensils,
  Smartphone,
  Home as HomeIcon,
  Sparkles,
  Watch,
  Palette,
  Scissors,
  ShoppingCart,
  Briefcase,
  Dumbbell,
  Wind,
  Gem,
  Package,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import type { List } from "@shared/schema";

interface AppSidebarProps {
  lists: List[];
  itemCounts: Record<string, number>;
  onAddList: () => void;
}

const getIconForList = (name: string, icon?: string) => {
  const customIconMap: Record<string, string> = {
    'Sweaters & Cardigans': '/attached_assets/sweater_1760701841052.png',
    'Perfumes': '/attached_assets/bottle_1760701841053.png',
    'Skirts': '/attached_assets/skirt_1760701841053.png',
    'Shoes': '/attached_assets/high-heels_1760701841053.png',
    'Shirts and Blouses': '/attached_assets/blouse_1760701841053.png',
    'Nails': '/attached_assets/nail_1760701841053.png',
    'Pants': '/attached_assets/trousers_1760701841053.png',
    'Makeup': '/attached_assets/makeup_1760701841054.png',
    'Dresses': '/attached_assets/dress_1760701841054.png',
    'Blazers': '/attached_assets/blazer_1760701841054.png',
    'Bags': '/attached_assets/handbag_1760701841054.png',
    'Coats': '/attached_assets/trench-coat_1760701841055.png',
  };

  const lucideIconMap: Record<string, any> = {
    'All Items': ListTodo,
    'Electronics': Smartphone,
    'Food': Utensils,
    'House Things': HomeIcon,
    'Extra Stuff': Package,
    'Jewelry': Gem,
    'Tops': Shirt,
    'Gym': Dumbbell,
    'Accessories': Watch,
  };

  return { customIcon: customIconMap[name], LucideIcon: lucideIconMap[name] || ListTodo };
};

export function AppSidebar({ lists, itemCounts, onAddList }: AppSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <h2 className="text-xl font-bold text-sidebar-primary">Wishly</h2>
        <p className="text-xs text-muted-foreground">Smart Wishlist Tracker</p>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"} data-testid="link-activity">
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span>Activity</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/goals"} data-testid="link-goals">
                  <Link href="/goals">
                    <Target className="h-4 w-4" />
                    <span>Goals</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Lists</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {lists.map((list) => {
                const { customIcon, LucideIcon } = getIconForList(list.name, list.icon);
                const count = itemCounts[list.id] || 0;
                const isActive = location === `/lists/${list.id}`;

                return (
                  <SidebarMenuItem key={list.id}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`link-list-${list.id}`}>
                      <Link href={`/lists/${list.id}`}>
                        {customIcon ? (
                          <img src={customIcon} alt={list.name} className="h-4 w-4" />
                        ) : (
                          <LucideIcon className="h-4 w-4" />
                        )}
                        <span>{list.name}</span>
                        {count > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {count}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onAddList}
          data-testid="button-add-list"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New List
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
