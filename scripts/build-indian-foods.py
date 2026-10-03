"""
Builds src/data/indian-foods.json, the seed for the dbo.Foods table.

Sources
  * Indian Nutrient Databank (INDB), Vijayakumar A, Dubasi HB, Awasthi A, Jaacks LM (2024),
    Current Developments in Nutrition. 1,014 recipes whose ingredient values come from the
    ICMR-NIN Indian Food Composition Tables 2017 (gaps from NIN 2004, UK CoFID, USDA).
    https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-
  * ICMR-NIN, Dietary Guidelines for Indians, 2nd ed. (2011), Annexure 8:
    "Approximate Calorific Value of Some Cooked Preparations" (kcal per household serving).

Rules
  * For dishes listed in NIN Annexure 8, NIN's calories per serving are used. Protein, carbs,
    fat and fibre keep the proportions of the matching INDB recipe.
  * INDB counts all deep-frying oil as eaten, so fried items show 60-90 g fat per 100 g.
    Those rows are dropped; fried items listed by NIN use NIN calories with an assumed share
    of energy from fat (marked "estimated").
  * Rows with implausible servings (over 1,000 kcal) are dropped.

Usage:  python scripts/build-indian-foods.py <path-to-INDB.xlsx>
"""
import json
import math
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "indian-foods.json"

NATURALLY_FATTY = re.compile(r"mayonnaise|dressing|sauce|pickle|achar|aachar|burfi|cookie|biscuit|baghar|tadka|chikki|ladoo|laddu", re.I)

CATEGORIES = [
    ("Beverages", r"\btea\b|coffee|lassi|juice|sharbat|shake|smoothie|soda|lemonade|punch|cooler|squash|thandai|chaas|buttermilk|kehwa|drink|mocktail|cocoa"),
    ("Soups", r"soup|consomme|\bstock\b|rasam|shorba"),
    ("Sweets & desserts", r"kheer|halwa|ladoo|laddu|burfi|barfi|jamun|payasam|cake|pudding|custard|ice.?cream|cookie|biscuit|\bpie\b|tart|gateau|mousse|souffle|pastry|sweet|jalebi|rasgulla|shrikhand|srikhand|sandesh|chikki|kulfi|sundae|meringue|pavlova|trifle|brownie|muffin|gujia|gunjia|ghujia|mal pua|rabri|phirni"),
    ("Chutneys & pickles", r"chutney|pickle|achar|aachar|sauce|dressing|\bdip\b|\bjam\b|baghar|tadka|raita"),
    ("Salads", r"salad"),
    ("Breakfast", r"idli|dosa|uttapam|upma|poha|appam|puttu|cheela|chilla|pesarattu|dhokla|khaman|porridge|daliya|cornflakes|muesli|oats"),
    ("Breads & sandwiches", r"chapati|roti|phulka|naan|kulcha|parantha|paratha|puri|poori|bhatura|thepla|bread|\bbun\b|toast|sandwich|khakhra|burger|pizza|hot dog|wrap|roll"),
    ("Rice dishes", r"rice|pulao|biryani|biriyani|khichdi|khichri|khitchdi|kichidi|pongal"),
    ("Snacks", r"pakora|pakoda|bajji|bhajji|samosa|vada|bonda|cutlet|kebab|kabab|tikki|chaat|chat\b|bhel|\bsev\b|murukku|mathri|chips|namak paras|kachori|puff|fritter|muthia"),
    ("Meat, fish & eggs", r"chicken|mutton|fish|prawn|keema|\begg|omelette|omlet|lamb|meat|machli|jhinga|gushtaba"),
    ("Dals & legumes", r"\bdal\b|dhal|sambar|rajma|chole|channa|chana|lobia|kadhi|moong|masoor|urad|arhar|sprout|soya"),
    ("Curries & vegetables", r"curry|sabzi|masala|korma|kofta|paneer|palak|aloo|bhaji|bharta|vegetable|mushroom|gobhi|bhindi"),
]


def categorize(name: str) -> str:
    for label, pattern in CATEGORIES:
        if re.search(pattern, name, re.I):
            return label
    return "Indian dishes"


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def r1(v: float) -> float:
    return round(float(v), 1)


def split_name(full: str):
    """'Curd rice (Dahi bhaat/Dahi chawal)' -> ('Curd rice', ['Dahi bhaat', 'Dahi chawal'])."""
    full = re.sub(r"\s+", " ", str(full)).strip()
    parens = re.findall(r"\(([^()]*)\)", full)
    base = re.sub(r"\([^()]*\)", "", full).strip(" ,")
    aliases = []
    for p in parens:
        aliases += [a.strip() for a in re.split(r"[/,]", p) if a.strip()]
    if "/" in base:
        aliases += [a.strip() for a in base.split("/") if a.strip()]
    return base, aliases


def profile(row) -> dict:
    return {
        "calories": r1(row["energy_kcal"]),
        "proteinG": r1(row["protein_g"]),
        "carbsG": r1(row["carb_g"]),
        "fatG": r1(row["fat_g"]),
        "fiberG": r1(row["fibre_g"]),
    }


def scaled_profile(row, kcal: float, grams: float) -> dict:
    """INDB macro proportions rescaled so one serving of `grams` provides NIN's `kcal`."""
    p, c, f, fb = (float(row[k]) for k in ("protein_g", "carb_g", "fat_g", "fibre_g"))
    energy = 4 * p + 4 * c + 9 * f
    k = (kcal / grams * 100) / energy
    return {"calories": r1(kcal / grams * 100), "proteinG": r1(p * k), "carbsG": r1(c * k), "fatG": r1(f * k), "fiberG": r1(fb * k)}


def fried_profile(row, kcal: float, grams: float, fat_share: float) -> dict:
    """For fried items whose INDB fat is inflated: fat supplies `fat_share` of energy,
    the rest is split between protein and carbs in the INDB recipe's ratio."""
    p, c, fb = (float(row[k]) for k in ("protein_g", "carb_g", "fibre_g"))
    per100 = kcal / grams * 100
    fat = per100 * fat_share / 9
    pc = per100 * (1 - fat_share) / 4
    prot = pc * p / (p + c)
    carbs = pc - prot
    fiber = carbs * fb / c if c else 0
    return {"calories": r1(per100), "proteinG": r1(prot), "carbsG": r1(carbs), "fatG": r1(fat), "fiberG": r1(fiber)}


# (id, name, aliases, INDB code for macro proportions, serving label, grams, kcal per serving, fried fat share or None, category)
NIN = [
    ("nin-rice", "Rice, boiled", ["rice", "plain rice", "steamed rice", "white rice", "chawal", "annam", "sadam"], "ASC113", "1 cup", 150, 170, None, "Rice dishes"),
    ("nin-phulka", "Chapati / Roti / Phulka", ["chapati", "chapathi", "chappathi", "roti", "phulka", "fulka", "rotli"], "ASC096", "1 chapati", 40, 80, None, "Breads & sandwiches"),
    ("nin-paratha", "Paratha, plain", ["paratha", "parantha", "plain paratha"], "ASC097", "1 paratha", 50, 150, None, "Breads & sandwiches"),
    ("nin-puri", "Puri", ["puri", "poori", "poorie"], "ASC107", "1 puri", 25, 80, 0.45, "Breads & sandwiches"),
    ("nin-poha", "Poha", ["poha", "aval", "avalakki", "atukulu", "chivda poha"], "BFP044", "1 cup", 160, 270, None, "Breakfast"),
    ("nin-upma", "Upma", ["upma", "uppittu", "rava upma", "suji upma"], "BFP039", "1 cup", 180, 270, None, "Breakfast"),
    ("nin-idli", "Idli", ["idli", "idly", "iddli", "idlis"], "ASC144", "1 idli", 50, 75, None, "Breakfast"),
    ("nin-dosa", "Dosa, plain", ["dosa", "dosai", "dose", "plain dosa", "sada dosa"], "BFP148", "1 dosa", 60, 125, None, "Breakfast"),
    ("nin-masala-dosa", "Masala dosa", ["masala dosa", "masala dose"], "ASC146", "1 masala dosa", 150, 200, None, "Breakfast"),
    ("nin-khichdi", "Khichdi", ["khichdi", "khichri", "kichidi", "khichadi"], "BFP576", "1 cup", 200, 200, None, "Rice dishes"),
    ("nin-wheat-porridge", "Wheat porridge (daliya)", ["daliya", "dalia", "wheat porridge", "broken wheat"], "ASC047", "1 cup", 200, 220, None, "Breakfast"),
    ("nin-semolina-porridge", "Semolina porridge", ["rava porridge", "suji porridge", "semolina porridge"], "ASC048", "1 cup", 200, 220, None, "Breakfast"),
    ("nin-cereal-flakes", "Cornflakes with milk", ["cornflakes", "corn flakes", "cereal", "cereal with milk", "wheat flakes"], "ASC051", "1 cup", 200, 220, None, "Breakfast"),
    ("nin-dal", "Dal, plain", ["dal", "dhal", "daal", "toor dal", "arhar dal", "pappu", "paruppu"], "ASC155", "1 katori (½ cup)", 100, 100, None, "Dals & legumes"),
    ("nin-sambar", "Sambar", ["sambar", "sambhar", "saambar", "kuzhambu"], "ASC167", "1 cup", 200, 110, None, "Dals & legumes"),
    ("nin-veg-gravy", "Vegetable curry (with gravy)", ["vegetable curry", "veg curry", "sabzi gravy", "curry"], "ASC190", "1 cup", 200, 170, None, "Curries & vegetables"),
    ("nin-veg-dry", "Vegetable, dry (sabzi / poriyal)", ["sabzi", "sabji", "poriyal", "palya", "thoran", "dry vegetable", "bhaji"], "BFP239", "1 cup", 150, 150, None, "Curries & vegetables"),
    ("nin-boiled-egg", "Egg, boiled", ["boiled egg", "egg", "eggs", "anda", "ubla anda"], "ASC056", "1 egg", 50, 90, None, "Meat, fish & eggs"),
    ("nin-omelette", "Omelette", ["omelette", "omelet", "omlet", "egg omelette"], "ASC061", "1 omelette", 70, 160, None, "Meat, fish & eggs"),
    ("nin-fried-egg", "Egg, fried", ["fried egg", "egg fry", "half fry", "bullseye"], "ASC057", "1 egg", 55, 160, None, "Meat, fish & eggs"),
    ("nin-mutton-curry", "Mutton curry", ["mutton curry", "mutton", "goat curry", "lamb curry"], "BFP194", "¾ cup", 150, 260, None, "Meat, fish & eggs"),
    ("nin-chicken-curry", "Chicken curry", ["chicken curry", "chicken gravy", "chicken masala", "chicken"], "ASC240", "¾ cup", 150, 240, None, "Meat, fish & eggs"),
    ("nin-fish-fry", "Fish fry", ["fish fry", "fried fish", "meen varuval", "machli fry"], "ASC247", "1 big piece", 60, 95, 0.45, "Meat, fish & eggs"),
    ("nin-fish-cutlet", "Fish cutlet", ["fish cutlet"], "ASC369", "1 cutlet", 45, 95, 0.4, "Meat, fish & eggs"),
    ("nin-prawn-curry", "Prawn curry", ["prawn curry", "jhinga curry", "shrimp curry", "prawns"], "BFP230", "¾ cup", 150, 220, None, "Meat, fish & eggs"),
    ("nin-keema-kofta", "Keema kofta curry", ["keema kofta", "kofta curry"], "ASC230", "¾ cup (6 small koftas)", 150, 240, None, "Meat, fish & eggs"),
    ("nin-pakora", "Bajji / Pakora", ["bajji", "bhajji", "bhaji pakora", "pakora", "pakoda", "pakodi", "bhajiya", "fritter"], "ASC354", "1 piece", 15, 35, 0.5, "Snacks"),
    ("nin-dahi-vada", "Dahi vada", ["dahi vada", "dahi bhalla", "thayir vadai", "perugu vada"], "ASC279", "1 dahi vada", 70, 90, 0.4, "Snacks"),
    ("nin-vada", "Vada (medu vada)", ["vada", "vadai", "wada", "medu vada", "uzhunnu vada", "garelu", "ulundu vadai"], "BFP436", "1 vada", 35, 70, 0.45, "Snacks"),
    ("nin-masala-vada", "Masala vada", ["masala vada", "paruppu vadai", "dal vada", "aama vadai"], "BFP437", "1 vada", 30, 75, 0.45, "Snacks"),
    ("nin-kachori", "Pea kachori", ["kachori", "matar kachori", "pea kachori"], "BFP118", "1 kachori", 50, 190, 0.5, "Snacks"),
    ("nin-bonda", "Potato bonda", ["bonda", "aloo bonda", "potato bonda", "batata vada"], "ASC360", "1 bonda", 45, 100, 0.45, "Snacks"),
    ("nin-sago-vada", "Sabudana vada", ["sabudana vada", "sago vada"], "ASC379", "1 vada", 40, 105, 0.45, "Snacks"),
    ("nin-samosa", "Samosa", ["samosa", "samosas", "aloo samosa"], "ASC361", "1 samosa", 70, 200, 0.5, "Snacks"),
    ("nin-veg-puff", "Vegetable puff", ["puff", "veg puff", "vegetable puff"], "BFP431", "1 puff", 75, 200, 0.55, "Snacks"),
    ("nin-cheese-balls", "Cheese balls", ["cheese balls", "cheese ball"], "ASC409", "1 ball", 30, 125, 0.6, "Snacks"),
    ("nin-pizza", "Pizza (cheese and tomato)", ["pizza", "cheese pizza", "margherita"], "ASC376", "1 slice", 80, 200, None, "Breads & sandwiches"),
    ("nin-coconut-chutney", "Coconut chutney", ["coconut chutney", "chutney", "nariyal chutney", "thengai chutney"], "ASC386", "1 tbsp", 15, 60, None, "Chutneys & pickles"),
    ("nin-peanut-chutney", "Groundnut chutney", ["peanut chutney", "groundnut chutney", "palli chutney", "shenga chutney"], "ASC385", "1 tbsp", 15, 60, None, "Chutneys & pickles"),
    ("nin-semolina-halwa", "Kesari / Rava halwa", ["kesari", "kesari bath", "rava kesari", "suji halwa", "sheera", "halwa"], "ASC293", "½ cup", 100, 320, None, "Sweets & desserts"),
    ("nin-custard", "Caramel custard", ["custard", "caramel custard"], "ASC300", "½ cup", 100, 160, None, "Sweets & desserts"),
    ("nin-tea", "Tea with milk and sugar", ["tea", "chai", "chaya", "masala chai", "milk tea"], "ASC001", "1 cup (150 ml)", 150, 75, None, "Beverages"),
    ("nin-coffee", "Coffee with milk and sugar", ["coffee", "filter coffee", "kaapi", "milk coffee"], "ASC002", "1 cup (150 ml)", 150, 110, None, "Beverages"),
    ("nin-lassi", "Lassi, sweet", ["lassi", "sweet lassi", "meethi lassi"], "ASC021", "1 glass (200 ml)", 200, 110, None, "Beverages"),
]

# Drinks that are essentially sugar: NIN calories, all energy from carbohydrate.
NIN_SUGAR = [
    ("nin-squash", "Squash (diluted)", ["squash", "rasna", "fruit squash"], "1 glass (200 ml)", 200, 75),
    ("nin-sharbat", "Sharbat / Syrup drink", ["sharbat", "sherbet", "rooh afza", "syrup drink"], "1 glass (200 ml)", 200, 200),
    ("nin-cold-drink", "Cold drink (soft drink)", ["cold drink", "soft drink", "soda pop", "thums up", "coke", "pepsi", "sprite"], "1 bottle (200 ml)", 200, 150),
    ("nin-lime-juice", "Fresh lime juice (sweetened)", ["lime juice", "nimbu pani", "lemon juice", "lemonade", "shikanji"], "1 glass", 200, 60),
]


# Raw foods straight from IFCT 2017 Table 1 (per 100 g edible portion): protein, fat, fibre, carbs, energy kJ.
IFCT = [
    ("ifct-l002", "Milk, cow (whole)", ["milk", "cow milk", "doodh", "paal", "full cream milk"], "Beverages", 3.26, 4.48, 0, 4.94, 305, [("glass", "1 glass (200 ml)", 206), ("cup", "1 cup (150 ml)", 155)], "L002"),
    ("ifct-l001", "Milk, buffalo (whole)", ["buffalo milk", "bhains ka doodh"], "Beverages", 3.68, 6.58, 0, 8.39, 449, [("glass", "1 glass (200 ml)", 206)], "L001"),
    ("ifct-l003", "Paneer", ["paneer", "cottage cheese indian", "chhena"], "Dals & legumes", 18.86, 24.78, 0, 2.41, 1278, [("cube", "1 cube (25 g)", 25), ("cup", "½ cup cubes", 100)], "L003"),
]


def main(path: str):
    df = pd.read_excel(path)
    by_code = {r["food_code"]: r for _, r in df.iterrows()}
    foods, used_codes = [], set()

    for fid, name, aliases, code, label, grams, kcal, fat_share, category in NIN:
        row = by_code[code]
        per100 = fried_profile(row, kcal, grams, fat_share) if fat_share else scaled_profile(row, kcal, grams)
        source = "ICMR-NIN DGI 2011 Annexure 8 (kcal); INDB/IFCT 2017 macro ratios" + ("; fat share estimated" if fat_share else "")
        foods.append({"id": fid, "name": name, "aliases": aliases, "category": category, "per100g": per100,
                      "servings": [{"id": "serving", "label": label, "grams": grams}], "source": source, "priority": 2})
        used_codes.add(code)

    pizza = next(f for f in foods if f["id"] == "nin-pizza")
    pizza["servings"].append({"id": "whole", "label": "whole pizza (6 slices)", "grams": 480})

    for fid, name, aliases, label, grams, kcal in NIN_SUGAR:
        foods.append({"id": fid, "name": name, "aliases": aliases, "category": "Beverages",
                      "per100g": {"calories": r1(kcal / grams * 100), "proteinG": 0, "carbsG": r1(kcal / 4 / grams * 100), "fatG": 0, "fiberG": 0},
                      "servings": [{"id": "serving", "label": label, "grams": grams}],
                      "source": "ICMR-NIN DGI 2011 Annexure 8 (kcal); sugar-only drink", "priority": 2})

    for fid, name, aliases, category, p, f, fb, c, kj, servings, code in IFCT:
        foods.append({"id": fid, "name": name, "aliases": aliases, "category": category,
                      "per100g": {"calories": r1(kj / 4.184), "proteinG": p, "carbsG": c, "fatG": f, "fiberG": fb},
                      "servings": [{"id": sid, "label": label, "grams": g} for sid, label, g in servings],
                      "source": f"ICMR-NIN IFCT 2017 {code}", "priority": 2})

    dropped = {"fried_oil": 0, "huge_serving": 0, "no_energy": 0}
    names_seen = {}
    for _, row in df.iterrows():
        kcal = row["energy_kcal"]
        if not kcal or (isinstance(kcal, float) and math.isnan(kcal)) or kcal <= 0:
            dropped["no_energy"] += 1
            continue
        base, aliases = split_name(row["food_name"])
        if row["fat_g"] > 35 and not NATURALLY_FATTY.search(str(row["food_name"])):
            dropped["fried_oil"] += 1
            continue
        serving_kcal = row["unit_serving_energy_kcal"]
        servings = []
        if isinstance(serving_kcal, (int, float)) and not math.isnan(serving_kcal):
            if serving_kcal > 1000:
                dropped["huge_serving"] += 1
                continue
            grams = round(serving_kcal / kcal * 100)
            unit = str(row["servings_unit"]).strip() if isinstance(row["servings_unit"], str) else ""
            if unit and unit.lower() not in ("gm", "ml") and 5 <= grams <= 700:
                servings.append({"id": "serving", "label": f"1 {unit}", "grams": grams})
        key = base.lower()
        if key in names_seen:
            base = str(row["food_name"]).strip()
        names_seen[key] = True
        foods.append({
            "id": f"indb-{str(row['food_code']).lower()}",
            "name": base,
            "aliases": aliases,
            "category": categorize(str(row["food_name"])),
            "per100g": profile(row),
            "servings": servings,
            "source": f"INDB {row['food_code']} (IFCT 2017)",
            "priority": 1,
        })

    OUT.write_text(json.dumps(foods, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(foods)} foods to {OUT.relative_to(ROOT)}; dropped {dropped}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
