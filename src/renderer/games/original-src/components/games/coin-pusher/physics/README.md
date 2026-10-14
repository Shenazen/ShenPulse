# Physique Coin Pusher

`../../coinPusherPhysics.ts` conserve les 47 exports publics et tous les types historiques. Les dimensions sont dans `constants.ts` ; les mouvements Plinko, plateau, plateau supérieur et stabilisation sont séparés. `stack-support.ts` traite les supports ; `stack-index.ts` possède l’index spatial et ses mises à jour ; `collisions.ts` gère les paires et les recherches spatiales. Les conversions communes sont dans `math.ts`.

La mémoire faible des supports de plateau supérieur reste propre à ce sous-moteur ; elle ne conserve pas les corps retirés. Le découpage ne change ni sous-pas, ni gravité, ni coefficients de rebond, ni règles de collision/empilement.

`coin-pusher-physics-architecture.test.js` protège l’API et les empreintes des formules et branches d’avant extraction. Les simulations exécutées, gains, états de manche et dessins du vrai jeu sont couverts par `coin-pusher-game-architecture.test.js` ; les deux suites sont complémentaires.
