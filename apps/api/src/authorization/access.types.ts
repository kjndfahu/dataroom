import type { ShareRole } from '@prisma/client';

/** What the current actor may do with a resource, and why. */
export interface AccessGrant {
  role: ShareRole;
  /** True when the access comes from owning the data room. */
  isOwner: boolean;
  dataRoomId: string;
}

export const ROLE_RANK: Record<ShareRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function canEdit(grant: AccessGrant): boolean {
  return ROLE_RANK[grant.role] >= ROLE_RANK.EDITOR;
}
