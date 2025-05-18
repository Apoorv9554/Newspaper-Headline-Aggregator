/// <reference types="node" />

declare module 'node-cache' {
    import { EventEmitter } from 'events';
    
    interface NodeCacheOptions {
        stdTTL?: number;
        checkperiod?: number;
        useClones?: boolean;
        deleteOnExpire?: boolean;
        enableLegacyCallbacks?: boolean;
        maxKeys?: number;
    }

    interface NodeCacheStats {
        hits: number;
        misses: number;
        keys: number;
        ksize: number;
        vsize: number;
    }

    class NodeCache extends EventEmitter {
        constructor(options?: NodeCacheOptions);
        get<T>(key: string): T | undefined;
        mget<T>(keys: string[]): { [key: string]: T };
        set<T>(key: string, value: T, ttl?: number): boolean;
        del(key: string | string[]): number;
        ttl(key: string, ttl: number): boolean;
        getTtl(key: string): number | undefined;
        keys(): string[];
        getStats(): NodeCacheStats;
        flushAll(): void;
        close(): void;
    }

    export = NodeCache;
} 