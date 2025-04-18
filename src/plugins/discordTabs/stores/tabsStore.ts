/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { proxyLazy } from "@utils/lazy";
import { showToast, Toasts, zustandCreate } from "@webpack/common";

import { BaseTab, LinkedNode, PersistedTabs } from "../interfaces";

function create<T extends object>(storeCreator: (set: (partial: (state: T) => Partial<T>) => void | Partial<T>, get: () => T) => (T)) {
    return proxyLazy(() => zustandCreate(storeCreator)) as () => T;
}

type LinkedListStore<T> = {
    nodes: Record<string, LinkedNode<T>>;
    head?: string;
    tail?: string;
    size: number;
    addNode: (id: string, data: T) => void;
    removeNode: (id: string) => void;
    moveNode: (id: string, targetId: string, position: "before" | "after") => void;
    getOrderedNodes: () => T[];
    save: (userId: string) => void;
    load: (userId: string) => void;
};

export const useTabsStore = create<LinkedListStore<BaseTab>>((set, get) => ({
    nodes: {},
    head: undefined,
    tail: undefined,
    size: 0,

    save(userId) {
        if (!userId) return;
        const newData: PersistedTabs<BaseTab> = {
            [userId]: {
                tabs: get().nodes,
                head: get().head!,
                tail: get().tail!
            }
        };
        DataStore.set("discordtabs_tabs", newData);
    },
    load(userId) {
        if (!userId) return;
        const persistedTabsStore: Promise<PersistedTabs<BaseTab> | undefined> = DataStore.get("discordtabs_tabs");
        persistedTabsStore.then(persistedTabs => {
            const userTabs = persistedTabs?.[userId];
            if (!userTabs) {
                showToast("Failed to load tabs for user.", Toasts.Type.FAILURE);
                return;
            }
            set(state => ({ nodes: userTabs.tabs, head: userTabs.head, tail: userTabs.tail }));
            showToast("Loaded tabs!", Toasts.Type.SUCCESS);
        });
    },

    addNode: (id, data) => {
        set(state => {
            if (state.nodes[id]) return state;

            const newNode: LinkedNode<any> = { id, data };
            const newNodes = { ...state.nodes, [id]: newNode };

            if (!state.head) {
                return { nodes: newNodes, head: id, tail: id, size: 1 };
            }

            const tailNode = { ...state.nodes[state.tail!] };
            tailNode.next = id;
            newNodes[state.tail!] = tailNode;

            newNodes[id] = { ...newNode, prev: state.tail };

            return {
                nodes: newNodes,
                head: state.head,
                tail: id,
                size: state.size + 1
            };
        });
    },

    removeNode: id => {
        set(state => {
            if (!state.nodes[id]) return state;

            const node = state.nodes[id];
            const newNodes = { ...state.nodes };
            delete newNodes[id];

            if (node.prev) {
                const prevNode = { ...newNodes[node.prev] };
                prevNode.next = node.next;
                newNodes[node.prev] = prevNode;
            }

            if (node.next) {
                const nextNode = { ...newNodes[node.next] };
                nextNode.prev = node.prev;
                newNodes[node.next] = nextNode;
            }

            return {
                nodes: newNodes,
                head: state.head === id ? node.next : state.head,
                tail: state.tail === id ? node.prev : state.tail,
                size: state.size - 1
            };
        });
    },

    moveNode: (sourceId, targetId, position) => {
        console.log("moving", sourceId, targetId, position);
        set(state => {
            const { nodes } = state;
            const targetNodeRef = nodes[targetId];
            if (!nodes[sourceId] || !targetNodeRef || sourceId === targetId) return state;
            if (position === "before" && targetNodeRef.prev === sourceId) return state;
            if (position === "after" && targetNodeRef.next === sourceId) return state;
            const newNodes = { ...nodes };
            const source = { ...nodes[sourceId] };
            let target = { ...nodes[targetId] };

            if (source.prev) {
                const prevNode = { ...newNodes[source.prev], next: source.next };
                newNodes[source.prev] = prevNode;
                if (source.prev === targetId) target = prevNode;
            }
            if (source.next) {
                const nextNode = { ...newNodes[source.next], prev: source.prev };
                newNodes[source.next] = nextNode;
                if (source.next === targetId) target = nextNode;
            }

            let newHead = state.head === sourceId ? source.next : state.head;
            let newTail = state.tail === sourceId ? source.prev : state.tail;


            if (position === "before") {
                source.prev = target.prev;
                source.next = targetId;
                target.prev = sourceId;
                if (source.prev) {
                    newNodes[source.prev] = { ...newNodes[source.prev], next: sourceId };
                } else {
                    newHead = sourceId;
                }

            } else {
                source.prev = targetId;
                source.next = target.next;
                target.next = sourceId;

                if (source.next) {
                    newNodes[source.next] = { ...newNodes[source.next], prev: sourceId };
                } else {
                    newTail = sourceId; // Target was tail
                }
            }

            return {
                nodes: {
                    ...newNodes,
                    [sourceId]: source,
                    [targetId]: target
                },
                head: newHead,
                tail: newTail
            };
        });
    },

    getOrderedNodes: () => {
        const { nodes, head } = get();
        const ordered: BaseTab[] = [];
        let current = nodes[head!]; // Cache node reference
        while (current) {
            ordered.push(current.data);
            current = nodes[current.next!]; // Update cached reference
        }
        return ordered;
    }
}));
