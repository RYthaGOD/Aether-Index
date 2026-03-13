import { PubSub } from 'graphql-subscriptions';

/**
 * Global AetherIndex Alpha Stream
 * A unified PubSub instance for cross-module coordination.
 */
export const pubsub = new PubSub();
