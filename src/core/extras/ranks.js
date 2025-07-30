export const Ranks = {
  ADMIN: 2,
  BUILDER: 1,
  VISITOR: 0,
}

export const isRank = (playerRank, targetRank) => {
  return playerRank === targetRank
}

export const hasRank = (playerRank, minRank) => {
  return playerRank >= minRank
}
