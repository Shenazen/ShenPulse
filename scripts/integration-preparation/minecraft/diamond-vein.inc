        // n2 correspond à la quantité annoncée : 60 ou 200 minerais.
        org.bukkit.World world = player.getWorld();
        int centerX = Math.max(-18, Math.min(18, player.getLocation().getBlockX()));
        int centerZ = Math.max(-18, Math.min(18, player.getLocation().getBlockZ()));
        int top = Math.max(-6, Math.min(31, player.getLocation().getBlockY() - 1));
        int requested = Math.max(1, Math.min(3000, n2)), placed = 0;
        outer: for (int radius = 1; radius <= 38; radius++) {
            for (int depth = 0; depth < 12; depth++) {
                int y = top - depth;
                if (y < -8) continue;
                for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) != radius) continue;
                    int x = centerX + dx, z = centerZ + dz;
                    if (x < -19 || x > 19 || z < -19 || z > 19) continue;
                    Block block = world.getBlockAt(x, y, z);
                    if (block.getType() != Material.STONE && block.getType() != Material.AIR) continue;
                    block.setType(Material.DIAMOND_ORE, false);
                    if (++placed >= requested) break outer;
                }
            }
        }
        player.sendTitle("§bFILON DE DIAMANTS", "§f" + placed + " minerais à récolter", 5, 40, 10);
        player.playSound(player.getLocation(), Sound.ENTITY_EXPERIENCE_ORB_PICKUP, 1.0f, 1.2f);
