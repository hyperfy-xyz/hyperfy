/**
 * Everything that needs to respond to input or modify output such as cameras is handled by binding controls.
 * Bound controls all use a priority system, and higher priority has the otpional ability to "consume" input/output,
 * preventing lower priority from seeing/responding to them.
 *
 * - Players are given base priority
 * - Builder requires taking over some of the player controls (eg mouse wheel) so this has a higher priority
 * - Apps are extensions of players and thus are the highest priority, allowing all manner of things such as vehicles etc.
 *
 */
export const ControlPriorities = {
  PLAYER: 0,
  BUILDER: 1,
  ENTITY: 2,
  APP: 3,
  ACTION: 4,
  GUI: 5,
}
