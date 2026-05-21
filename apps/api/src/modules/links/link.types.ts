export interface ILink {
  id: string;
  profileId: string;
  title: string;
  url: string;
  shortUrl: string | null;
  description: string | null;
  position: number;
  isActive: boolean;
  clickCount: number;
  revenueCents: bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ILinkSwap {
  id: string;
  profileId: string;
  fromLinkId: string;
  toLinkId: string;
  swappedAt: Date;
  revertedAt: Date | null;
}

export interface IScheduledSwap {
  id: string;
  profileId: string;
  linkId: string;
  scheduledFor: Date;
  jobId: string | null;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  metadata: Record<string, any>;
}