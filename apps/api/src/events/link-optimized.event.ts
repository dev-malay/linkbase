import EventEmitter from 'events'


const linkOptimizedEmitter = new EventEmitter();

export interface LinkOptimizedEvent {
  type: 'optimization_applied' | 'suggestion_generated' | 'pattern_detected';
  profileId: string;
  rankingId?: string;
  timestamp: Date;
}

export function emitLinkOptimized(event: LinkOptimizedEvent) {
  linkOptimizedEmitter.emit('link-optimized', event);
}

export function onLinkOptimized(callback: (event: LinkOptimizedEvent) => void) {
  linkOptimizedEmitter.on('link-optimized', callback)}