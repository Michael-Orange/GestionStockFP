import { Router } from "express";
import bcrypt from "bcrypt";
import { storage } from "../storage";
import { logger } from "../middleware/logger";

const router = Router();

router.post("/verify-admin", async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    
    if (!userId || !password) {
      return res.status(400).json({ error: "userId et password requis" });
    }
    
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Utilisateur n'est pas admin" });
    }
    
    if (!user.passwordHash) {
      return res.status(500).json({ error: "Mot de passe non configuré pour cet admin" });
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (isValid) {
      logger.info(`Admin ${user.nom} authentifié avec succès`);
      res.json({ success: true, user: { id: user.id, nom: user.nom, role: user.role } });
    } else {
      res.status(401).json({ success: false, error: "Mot de passe incorrect" });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
