        // Une seule file partagée : les cadeaux rapprochés ne réservent plus
        // plusieurs fois les mêmes emplacements encore vides.
        this.shenPendingFill = Math.min(972, this.shenPendingFill + Math.max(0, n));
        if (this.shenFillTask != null || this.shenPendingFill == 0) return;
        this.shenFillTask = Bukkit.getScheduler().runTaskTimer((Plugin)this.plugin, () -> {
            if (this.shenPendingFill <= 0) { this.shenCancelFill(); return; }
            for (int y = 15; y <= 26; y++) for (int x = -4; x <= 4; x++) for (int z = -26; z <= -18; z++) {
                if (world.getBlockAt(x,y,z).getType() != Material.AIR) continue;
                Material material = new Material[]{Material.IRON_BLOCK,Material.GOLD_BLOCK,Material.DIAMOND_BLOCK,Material.EMERALD_BLOCK}[(y-15)/3];
                world.getBlockAt(x,y,z).setType(material,false);
                this.shenPendingFill--;
                return;
            }
            this.shenCancelFill();
        }, 0L, 1L);
