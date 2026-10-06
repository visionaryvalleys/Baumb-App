import { matchFoods } from "@/calculations/food-parser";
import type { Food, NutritionProfile } from "@/lib/types";

function n(calories: number, proteinG: number, carbsG: number, fatG: number, fiberG: number): NutritionProfile {
  return { calories, proteinG, carbsG, fatG, fiberG };
}

/**
 * Built-in foods (values per 100 g, rounded from USDA FoodData Central), used alongside the
 * Indian food catalogue served from Postgres (`/api/foods`).
 */
export const FOODS: Food[] = [
  { id: "chicken-breast", name: "Chicken breast, cooked", category: "Protein", per100g: n(165, 31, 0, 3.6, 0), servings: [{ id: "fillet", label: "1 fillet", grams: 150 }] },
  { id: "salmon", name: "Salmon, cooked", category: "Protein", per100g: n(206, 22, 0, 12, 0), servings: [{ id: "fillet", label: "1 fillet", grams: 140 }] },
  { id: "tuna-can", name: "Tuna in water, drained", category: "Protein", per100g: n(116, 26, 0, 0.8, 0), servings: [{ id: "can", label: "1 can", grams: 120 }] },
  { id: "lean-beef", name: "Lean beef mince (5%), cooked", category: "Protein", per100g: n(171, 26, 0, 7, 0), servings: [{ id: "portion", label: "1 portion", grams: 125 }] },
  { id: "turkey-breast", name: "Turkey breast, sliced", category: "Protein", per100g: n(104, 22, 1.5, 1, 0), servings: [{ id: "slice", label: "1 slice", grams: 28 }] },
  { id: "egg", name: "Egg, whole", category: "Protein", per100g: n(143, 12.6, 0.7, 9.5, 0), servings: [{ id: "large", label: "1 large egg", grams: 50 }] },
  { id: "egg-white", name: "Egg white", category: "Protein", per100g: n(52, 11, 0.7, 0.2, 0), servings: [{ id: "large", label: "1 large white", grams: 33 }] },
  { id: "tofu", name: "Tofu, firm", category: "Protein", per100g: n(144, 17, 3, 9, 2), servings: [{ id: "block-quarter", label: "¼ block", grams: 100 }] },
  { id: "whey", name: "Whey protein powder", category: "Supplement", per100g: n(400, 80, 8, 6, 0), servings: [{ id: "scoop", label: "1 scoop", grams: 30 }] },
  { id: "greek-yogurt", name: "Greek yogurt, 0% fat", category: "Dairy", per100g: n(59, 10, 3.6, 0.4, 0), servings: [{ id: "pot", label: "1 pot", grams: 170 }] },
  { id: "milk-semi", name: "Milk, semi-skimmed", category: "Dairy", per100g: n(47, 3.5, 4.8, 1.7, 0), servings: [{ id: "glass", label: "1 glass", grams: 250 }] },
  { id: "cottage-cheese", name: "Cottage cheese", category: "Dairy", per100g: n(98, 11, 3.4, 4.3, 0), servings: [{ id: "cup", label: "½ cup", grams: 113 }] },
  { id: "cheddar", name: "Cheddar cheese", category: "Dairy", per100g: n(403, 25, 1.3, 33, 0), servings: [{ id: "slice", label: "1 slice", grams: 28 }] },
  { id: "oats", name: "Rolled oats, dry", category: "Grains", per100g: n(379, 13, 68, 6.5, 10), servings: [{ id: "bowl", label: "1 bowl", grams: 50 }] },
  { id: "white-rice", name: "White rice, cooked", category: "Grains", per100g: n(130, 2.7, 28, 0.3, 0.4), servings: [{ id: "cup", label: "1 cup", grams: 158 }] },
  { id: "brown-rice", name: "Brown rice, cooked", category: "Grains", per100g: n(123, 2.7, 26, 1, 1.6), servings: [{ id: "cup", label: "1 cup", grams: 195 }] },
  { id: "pasta", name: "Pasta, cooked", category: "Grains", per100g: n(158, 5.8, 31, 0.9, 1.8), servings: [{ id: "plate", label: "1 plate", grams: 200 }] },
  { id: "wholegrain-bread", name: "Wholegrain bread", category: "Grains", per100g: n(247, 13, 41, 3.4, 7), servings: [{ id: "slice", label: "1 slice", grams: 40 }] },
  { id: "bagel", name: "Bagel, plain", category: "Grains", per100g: n(257, 10, 50, 1.6, 2.2), servings: [{ id: "bagel", label: "1 bagel", grams: 95 }] },
  { id: "potato", name: "Potato, boiled", category: "Grains", per100g: n(87, 1.9, 20, 0.1, 1.8), servings: [{ id: "medium", label: "1 medium", grams: 170 }] },
  { id: "sweet-potato", name: "Sweet potato, baked", category: "Grains", per100g: n(90, 2, 21, 0.2, 3.3), servings: [{ id: "medium", label: "1 medium", grams: 150 }] },
  { id: "quinoa", name: "Quinoa, cooked", category: "Grains", per100g: n(120, 4.4, 21, 1.9, 2.8), servings: [{ id: "cup", label: "1 cup", grams: 185 }] },
  { id: "banana", name: "Banana", category: "Fruit", per100g: n(89, 1.1, 23, 0.3, 2.6), servings: [{ id: "medium", label: "1 medium", grams: 118 }] },
  { id: "apple", name: "Apple", category: "Fruit", per100g: n(52, 0.3, 14, 0.2, 2.4), servings: [{ id: "medium", label: "1 medium", grams: 182 }] },
  { id: "blueberries", name: "Blueberries", category: "Fruit", per100g: n(57, 0.7, 14, 0.3, 2.4), servings: [{ id: "cup", label: "1 cup", grams: 148 }] },
  { id: "orange", name: "Orange", category: "Fruit", per100g: n(47, 0.9, 12, 0.1, 2.4), servings: [{ id: "medium", label: "1 medium", grams: 131 }] },
  { id: "broccoli", name: "Broccoli, steamed", category: "Vegetables", per100g: n(35, 2.4, 7, 0.4, 3.3), servings: [{ id: "cup", label: "1 cup", grams: 156 }] },
  { id: "spinach", name: "Spinach, raw", category: "Vegetables", per100g: n(23, 2.9, 3.6, 0.4, 2.2), servings: [{ id: "handful", label: "1 handful", grams: 30 }] },
  { id: "mixed-salad", name: "Mixed salad leaves", category: "Vegetables", per100g: n(17, 1.3, 3.3, 0.2, 1.8), servings: [{ id: "bowl", label: "1 bowl", grams: 85 }] },
  { id: "avocado", name: "Avocado", category: "Fats", per100g: n(160, 2, 8.5, 15, 6.7), servings: [{ id: "half", label: "½ avocado", grams: 68 }] },
  { id: "olive-oil", name: "Olive oil", category: "Fats", per100g: n(884, 0, 0, 100, 0), servings: [{ id: "tbsp", label: "1 tbsp", grams: 13.5 }] },
  { id: "almonds", name: "Almonds", category: "Fats", per100g: n(579, 21, 22, 50, 12.5), servings: [{ id: "handful", label: "1 handful", grams: 28 }] },
  { id: "peanut-butter", name: "Peanut butter", category: "Fats", per100g: n(588, 25, 20, 50, 6), servings: [{ id: "tbsp", label: "1 tbsp", grams: 16 }] },
  { id: "lentils", name: "Lentils, cooked", category: "Legumes", per100g: n(116, 9, 20, 0.4, 7.9), servings: [{ id: "cup", label: "1 cup", grams: 198 }] },
  { id: "chickpeas", name: "Chickpeas, cooked", category: "Legumes", per100g: n(164, 8.9, 27, 2.6, 7.6), servings: [{ id: "cup", label: "1 cup", grams: 164 }] },
  { id: "dark-chocolate", name: "Dark chocolate (70%)", category: "Snacks", per100g: n(598, 7.8, 46, 43, 11), servings: [{ id: "square", label: "2 squares", grams: 20 }] },
  { id: "protein-bar", name: "Protein bar", category: "Snacks", per100g: n(350, 33, 35, 10, 8), servings: [{ id: "bar", label: "1 bar", grams: 60 }] },
  { id: "pizza", name: "Pizza, cheese", category: "Takeaway", per100g: n(266, 11, 33, 10, 2.3), servings: [{ id: "slice", label: "1 slice", grams: 107 }] },
  { id: "burger", name: "Burger with bun", category: "Takeaway", per100g: n(254, 13, 24, 12, 1.4), servings: [{ id: "burger", label: "1 burger", grams: 220 }] },
  { id: "fries", name: "French fries", category: "Takeaway", per100g: n(312, 3.4, 41, 15, 3.8), servings: [{ id: "medium", label: "Medium portion", grams: 117 }] },
  { id: "orange-juice", name: "Orange juice", category: "Drinks", per100g: n(45, 0.7, 10, 0.2, 0.2), servings: [{ id: "glass", label: "1 glass", grams: 250 }] },
  { id: "cola", name: "Cola", category: "Drinks", per100g: n(42, 0, 10.6, 0, 0), servings: [{ id: "can", label: "1 can", grams: 330 }] },
  { id: "beer", name: "Beer, regular", category: "Drinks", per100g: n(43, 0.5, 3.6, 0, 0), servings: [{ id: "pint", label: "1 pint", grams: 568 }] },
  { id: "latte", name: "Latte, semi-skimmed", category: "Drinks", per100g: n(54, 3.5, 5.3, 2, 0), servings: [{ id: "medium", label: "Medium cup", grams: 350 }] },
  { id: "creatine", name: "Creatine monohydrate", category: "Supplement", per100g: n(0, 0, 0, 0, 0), servings: [{ id: "scoop", label: "1 scoop", grams: 5 }] },
];

const BY_ID = new Map(FOODS.map((f) => [f.id, f]));

/** Custom foods first, then the Postgres catalogue, then the built-in list; ids are unique. */
export function foodPool(custom: Food[] = [], catalogue: Food[] = []): Food[] {
  const seen = new Set<string>();
  return [...custom, ...catalogue, ...FOODS].filter((f) => !seen.has(f.id) && (seen.add(f.id), true));
}

export function findFood(id: string, custom: Food[] = [], catalogue: Food[] = []): Food | undefined {
  return custom.find((f) => f.id === id) ?? catalogue.find((f) => f.id === id) ?? BY_ID.get(id);
}

export function searchFoods(query: string, pool: Food[], limit = 12): Food[] {
  if (!query.trim()) return pool.slice(0, limit);
  return matchFoods(query, pool, limit).map((m) => m.food);
}
