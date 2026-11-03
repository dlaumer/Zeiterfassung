// Temporary presentation setting. Set to false and rebuild to restore identities.
// Display masking only: stored records and API/export access are unchanged.
export const PRESENTATION_PRIVACY = true;

export function participantDisplayName(participant: { id: string; name?: string }) {
  return PRESENTATION_PRIVACY ? participant.id : participant.name || participant.id;
}
