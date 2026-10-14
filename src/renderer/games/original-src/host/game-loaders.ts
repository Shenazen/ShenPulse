/** Un seul moteur est téléchargé : Puissance 4 ne charge jamais le WebGL Coin Pusher. */
export const gameLoaders = {
  'coin-pusher': () => import('../components/games/CoinPusherGame.vue'),
  'connect-four': () => import('../components/games/ConnectFourGame.vue'),
  'deal-or-no-deal': () => import('../components/games/DealOrNoDealGame.vue'),
  'thiercelieux': () => import('../components/games/ThiercelieuxGame.vue'),
}
