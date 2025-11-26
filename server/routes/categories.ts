import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const allProducts = await storage.getAllProducts();
    const validatedProducts = allProducts.filter((p) => p.statut === "valide");
    
    const categoryMap = new Map<string, { count: number; sousSections: Set<string> }>();
    
    validatedProducts.forEach((product) => {
      if (!categoryMap.has(product.categorie)) {
        categoryMap.set(product.categorie, { count: 0, sousSections: new Set() });
      }
      const catInfo = categoryMap.get(product.categorie)!;
      catInfo.count++;
      catInfo.sousSections.add(product.sousSection);
    });

    const categories = Array.from(categoryMap.entries())
      .map(([categorie, info]) => ({
        categorie,
        count: info.count,
        sousSections: Array.from(info.sousSections),
      }))
      .sort((a, b) => a.categorie.localeCompare(b.categorie));

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

router.get("/:categorie/sous-sections", async (req, res, next) => {
  try {
    const { categorie } = req.params;
    const allProducts = await storage.getAllProducts();
    const validatedProducts = allProducts.filter(
      (p) => p.statut === "valide" && p.categorie === categorie
    );
    
    const sousSectionsSet = new Set<string>();
    validatedProducts.forEach((product) => {
      sousSectionsSet.add(product.sousSection);
    });

    const sousSections = Array.from(sousSectionsSet).sort((a, b) => {
      if (a === "Tous") return -1;
      if (b === "Tous") return 1;
      return a.localeCompare(b);
    });
    
    res.json(sousSections);
  } catch (error) {
    next(error);
  }
});

export default router;
