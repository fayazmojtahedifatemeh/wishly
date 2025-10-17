import {
  type Item,
  type InsertItem,
  type PriceHistory,
  type InsertPriceHistory,
  type List,
  type InsertList,
  type Goal,
  type InsertGoal,
  type Activity,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Items
  getItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: string, updates: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: string): Promise<boolean>;

  // Price History
  getPriceHistory(itemId: string): Promise<PriceHistory[]>;
  addPriceHistory(history: InsertPriceHistory): Promise<PriceHistory>;
  getRecentPriceChanges(limit: number): Promise<Activity[]>;

  // Lists
  getLists(): Promise<List[]>;
  getList(id: string): Promise<List | undefined>;
  createList(list: InsertList): Promise<List>;
  deleteList(id: string): Promise<boolean>;

  // Goals
  getGoals(): Promise<Goal[]>;
  getGoal(id: string): Promise<Goal | undefined>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal | undefined>;
  deleteGoal(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private items: Map<string, Item>;
  private priceHistory: Map<string, PriceHistory>;
  private lists: Map<string, List>;
  private goals: Map<string, Goal>;

  constructor() {
    this.items = new Map();
    this.priceHistory = new Map();
    this.lists = new Map();
    this.goals = new Map();

    // Initialize default lists
    this.initializeDefaultLists();
  }

  private async initializeDefaultLists() {
    const defaultLists = [
      { name: "All Items", isDefault: true },
      { name: "Skirts", isDefault: true },
      { name: "Dresses", isDefault: true },
      { name: "Coats", isDefault: true },
      { name: "Shoes", isDefault: true },
      { name: "Electronics", isDefault: true },
      { name: "Food", isDefault: true },
      { name: "House Things", isDefault: true },
      { name: "Extra Stuff", isDefault: true },
      { name: "Jewelry", isDefault: true },
      { name: "Tops", isDefault: true },
      { name: "Nails", isDefault: true },
      { name: "Makeup", isDefault: true },
      { name: "Pants", isDefault: true },
      { name: "Bags", isDefault: true },
      { name: "Blazers", isDefault: true },
      { name: "Gym", isDefault: true },
      { name: "Sweaters & Cardigans", isDefault: true },
      { name: "Accessories", isDefault: true },
      { name: "Perfumes", isDefault: true },
      { name: "Shirts and Blouses", isDefault: true },
    ];

    for (const list of defaultLists) {
      const id = list.name.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
      this.lists.set(id, {
        id,
        ...list,
        icon: null,
        createdAt: new Date(),
      });
    }
  }

  // Items
  async getItems(): Promise<Item[]> {
    return Array.from(this.items.values());
  }

  async getItem(id: string): Promise<Item | undefined> {
    return this.items.get(id);
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const id = randomUUID();
    const item: Item = {
      ...insertItem,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.set(id, item);

    // Add initial price history
    await this.addPriceHistory({
      itemId: id,
      price: item.price,
      currency: item.currency,
      inStock: item.inStock,
    });

    return item;
  }

  async updateItem(id: string, updates: Partial<InsertItem>): Promise<Item | undefined> {
    const item = this.items.get(id);
    if (!item) return undefined;

    const updatedItem: Item = {
      ...item,
      ...updates,
      updatedAt: new Date(),
    };

    this.items.set(id, updatedItem);

    // If price changed, add to history
    if (updates.price !== undefined && updates.price !== item.price) {
      await this.addPriceHistory({
        itemId: id,
        price: updates.price,
        currency: updates.currency || item.currency,
        inStock: updates.inStock ?? item.inStock,
      });
    }

    return updatedItem;
  }

  async deleteItem(id: string): Promise<boolean> {
    // Delete associated price history
    const historyToDelete = Array.from(this.priceHistory.values()).filter(
      (h) => h.itemId === id
    );
    historyToDelete.forEach((h) => this.priceHistory.delete(h.id));

    return this.items.delete(id);
  }

  // Price History
  async getPriceHistory(itemId: string): Promise<PriceHistory[]> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return Array.from(this.priceHistory.values())
      .filter((h) => h.itemId === itemId && new Date(h.checkedAt) >= threeMonthsAgo)
      .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());
  }

  async addPriceHistory(history: InsertPriceHistory): Promise<PriceHistory> {
    const id = randomUUID();
    const priceHistory: PriceHistory = {
      ...history,
      id,
      checkedAt: new Date(),
    };
    this.priceHistory.set(id, priceHistory);
    return priceHistory;
  }

  async getRecentPriceChanges(limit: number = 10): Promise<Activity[]> {
    const activities: Activity[] = [];
    const items = Array.from(this.items.values());

    for (const item of items) {
      const history = await this.getPriceHistory(item.id);
      if (history.length < 2) continue;

      // Get the last two price points
      const recent = history[history.length - 1];
      const previous = history[history.length - 2];

      if (recent.price !== previous.price) {
        activities.push({
          id: `${item.id}-${recent.id}`,
          itemId: item.id,
          itemName: item.name,
          itemImage: Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '',
          oldPrice: previous.price,
          newPrice: recent.price,
          currency: item.currency,
          changeType: recent.price > previous.price ? 'increase' : 'decrease',
          timestamp: recent.checkedAt,
        });
      }
    }

    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Lists
  async getLists(): Promise<List[]> {
    return Array.from(this.lists.values()).sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async getList(id: string): Promise<List | undefined> {
    return this.lists.get(id);
  }

  async createList(insertList: InsertList): Promise<List> {
    const id = randomUUID();
    const list: List = {
      ...insertList,
      id,
      isDefault: false,
      createdAt: new Date(),
    };
    this.lists.set(id, list);
    return list;
  }

  async deleteList(id: string): Promise<boolean> {
    const list = this.lists.get(id);
    if (list?.isDefault) {
      throw new Error("Cannot delete default lists");
    }
    return this.lists.delete(id);
  }

  // Goals
  async getGoals(): Promise<Goal[]> {
    return Array.from(this.goals.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getGoal(id: string): Promise<Goal | undefined> {
    return this.goals.get(id);
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const id = randomUUID();
    const goal: Goal = {
      ...insertGoal,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.goals.set(id, goal);
    return goal;
  }

  async updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal | undefined> {
    const goal = this.goals.get(id);
    if (!goal) return undefined;

    const updatedGoal: Goal = {
      ...goal,
      ...updates,
      updatedAt: new Date(),
    };

    this.goals.set(id, updatedGoal);
    return updatedGoal;
  }

  async deleteGoal(id: string): Promise<boolean> {
    return this.goals.delete(id);
  }
}

export const storage = new MemStorage();
