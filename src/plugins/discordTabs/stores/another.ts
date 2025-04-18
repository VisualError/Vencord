/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { proxyLazy } from "@utils/lazy";
import { UserStore, zustandCreate, zustandPersist } from "@webpack/common";

import { BaseTab, LinkedNode } from "../interfaces";
type LinkedList<T> = {
    nodes: Record<string, LinkedNode<T>>;
    head?: string;
    tail?: string;
};

type UserContainer<T> = Record<string, LinkedList<T>>;

type LinkedListStore<T> = {
    containers: UserContainer<T>;
    tabIds: Record<string, Set<string>>;
    _containers: Record<string, UserContainer<T>>;
    addNode: (containerId: string, id: string, data: T) => void;
    removeNode: (containerId: string, id: string) => void;
    moveNode: (sourceId: string, sourceContainerId: string, targetId: string, targetContainerId: string, position: "before" | "after") => void;
    getContainer: (containerId: string) => LinkedList<T>;
    getOrderedNodes: (containerId: string) => T[];
    init: () => void;
};

type Bruh<T> = {
    (): T,
    getState(): T;
};
type StateSetter<T> = (newState: Partial<T> | ((prevState: T) => Partial<T>)) => void;
type StateGetter<T> = () => T;

const storage = {
    async getItem(name: string): Promise<string | null> {
        return DataStore.get(name).then(v => v ?? null);
    },
    async setItem(name: string, value: string): Promise<void> {
        await DataStore.set(name, value);
    },
    async removeItem(name: string): Promise<void> {
        await DataStore.del(name);
    },
};

function createPersist<T extends object>(storeCreator: (set: StateSetter<T>, get: StateGetter<T>) => (T), options: any) {
    return proxyLazy(() => zustandCreate(zustandPersist(storeCreator, options))) as Bruh<T>;
}

export const useTabsStore = createPersist<LinkedListStore<BaseTab>>(
    (set, get) => ({
        containers: {},
        tabIds: {},
        _containers: {},
        init: () => {
            console.log("Initializing TabsStore");
            const containers = get()._containers[UserStore.getCurrentUser().id] ?? null;
            if (!containers) return;
            const tabIds = {};
            for (const [group, innerObject] of Object.entries(containers)) {
                for (const id in innerObject.nodes) {
                    tabIds[id] = tabIds[id] ? tabIds[id].add(group) : new Set([group]);
                }
            }
            console.log("tabids", tabIds);
            set({ containers: containers, tabIds: tabIds });
        },
        getContainer(containerId) {
            const container = get().containers[containerId];
            if (!container) {
                set(state => ({ containers: { ...state.containers, [containerId]: { nodes: {} } } }));
                return get().containers[containerId];
            }
            return container;
        },
        addNode(containerId, id, data) {
            set(state => {
                const container = state.containers[containerId];
                if (!container) throw "Container does not exist.";
                if (container.nodes[id]) return state;
                const newNode: LinkedNode<any> = { id, data, prev: container.tail };
                const newHead = container.head ? container.head : id;
                const newNodes = { ...container.nodes, [id]: newNode };
                if (container.tail) {
                    newNodes[container.tail] = { ...container.nodes[container.tail], next: id };
                }
                const newContainer = { ...container, nodes: newNodes, head: newHead, tail: id };
                const newContainers = { ...state.containers, [containerId]: newContainer };
                const newTabIds = { ...state.tabIds };
                newTabIds[id] = newTabIds[id] ? new Set([...newTabIds[id], containerId]) : new Set([containerId]);
                return {
                    _containers: { ...state._containers, [UserStore.getCurrentUser().id]: newContainers },
                    containers: newContainers,
                    tabIds: newTabIds,
                };
            });
        },
        // trol.
        moveNode(sourceId, sourceContainerId, targetId, targetContainerId, position) {
            // const targetContainer = get().containers[targetContainerId];
            // if (!targetContainer) throw "Target container does not exist!";
            // if (sourceContainerId !== targetContainerId && targetContainer.nodes[sourceId]) {
            //     get().removeNode(sourceContainerId, sourceId);
            //     return;
            // }
            set(state => {
                const sourceContainer = state.containers[sourceContainerId];
                const targetContainer = get().containers[targetContainerId];
                if (!sourceContainer) throw "Source container does not exist!";
                if (!targetContainer) throw "Target container does not exist!";
                const sourceRef = sourceContainer.nodes[sourceId];
                const targetRef = targetContainer.nodes[targetId];
                if (!sourceRef || !targetRef) throw "Source or target tabs does not exist!";
                if (sourceId === targetId) return state;

                if (position === "before" && targetRef.prev === sourceId) return state;
                if (position === "after" && targetRef.next === sourceId) return state;
                const newSource = { ...sourceRef };
                const newTarget = { ...targetRef };

                // Remove the source node from its original container first.
                const newSourceContainerNodes = { ...sourceContainer.nodes };
                delete newSourceContainerNodes[sourceId];
                if (newSource.prev === targetId && sourceContainerId === targetContainerId) {
                    newTarget.next = newSource.next;
                } else if (newSource.prev) {
                    newSourceContainerNodes[newSource.prev] = { ...newSourceContainerNodes[newSource.prev], next: newSource.next };
                }

                if (newSource.next === targetId && sourceContainerId === targetContainerId) {
                    newTarget.prev = newSource.prev;
                } if (newSource.next) {
                    newSourceContainerNodes[newSource.next] = { ...newSourceContainerNodes[newSource.next], prev: newSource.prev };
                }
                const newSourceContainer = {
                    ...sourceContainer,
                    nodes: newSourceContainerNodes,
                    head: sourceContainer.head === sourceId ? newSource.next : sourceContainer.head,
                    tail: sourceContainer.tail === sourceId ? newSource.prev : sourceContainer.tail,
                };
                // tis the end of remuval,bm,,m

                // Now we can start.
                const targetNodes = sourceContainerId !== targetContainerId ? targetContainer.nodes : newSourceContainerNodes;
                const newTargetContainerNodes = { ...targetNodes };
                let newHead = targetContainer.head === sourceId ? newSource.next : targetContainer.head;
                let newTail = targetContainer.tail === sourceId ? newSource.prev : targetContainer.tail;

                if (position === "before") {
                    newSource.prev = newTarget.prev;
                    newSource.next = targetId;
                    newTarget.prev = sourceId;
                    if (newSource.prev) {
                        newTargetContainerNodes[newSource.prev] = { ...newTargetContainerNodes[newSource.prev], next: sourceId };
                    } else {
                        newHead = sourceId;
                    }
                } else {
                    newSource.prev = targetId;
                    newSource.next = newTarget.next;
                    newTarget.next = sourceId;

                    if (newSource.next) {
                        newTargetContainerNodes[newSource.next] = { ...newTargetContainerNodes[newSource.next], prev: sourceId };
                    } else {
                        newTail = sourceId;
                    }
                }

                const newTargetContainer = {
                    ...targetContainer,
                    nodes: {
                        ...newTargetContainerNodes,
                        [sourceId]: newSource,
                        [targetId]: newTarget
                    },
                    head: newHead,
                    tail: newTail
                };

                const newContainers = { ...state.containers, [sourceContainerId]: newSourceContainer, [targetContainerId]: newTargetContainer };

                return {
                    _containers: { ...state._containers, [UserStore.getCurrentUser().id]: newContainers },
                    containers: newContainers,
                };
            });
        },
        removeNode(containerId, id) {
            set(state => {
                const container = state.containers[containerId];
                if (!container) throw "Container does not exist.";
                const nodeRef = container.nodes[id];

                const newNodes = { ...container.nodes };
                delete newNodes[id];
                if (nodeRef.prev) {
                    newNodes[nodeRef.prev] = { ...newNodes[nodeRef.prev], next: nodeRef.next };
                }
                if (nodeRef.next) {
                    newNodes[nodeRef.next] = { ...newNodes[nodeRef.next], prev: nodeRef.prev };
                }
                const newContainer = {
                    ...state.containers[containerId],
                    nodes: newNodes,
                    head: container.head === id ? nodeRef.next : container.head,
                    tail: container.tail === id ? nodeRef.prev : container.tail,
                };
                const newContainers = { ...state.containers, [containerId]: newContainer };

                const newTabIds = { ...state.tabIds };
                const updatedSet = new Set(newTabIds[id]);
                updatedSet.delete(containerId);
                if (updatedSet.size === 0) {
                    delete newTabIds[id];
                } else {
                    newTabIds[id] = updatedSet;
                }

                return {
                    _containers: { ...state._containers, [UserStore.getCurrentUser().id]: newContainers },
                    containers: newContainers,
                    tabIds: newTabIds,
                };
            });
        },
        getOrderedNodes(containerId) {
            const container = get().containers[containerId];
            console.log(container);
            if (!container) throw "Container does not exist.";
            const { nodes, head } = container;
            const ordered: BaseTab[] = [];
            let current = nodes[head!];
            while (current) {
                ordered.push(current.data);
                current = nodes[current.next!];
            }
            return ordered;
        },
    }),
    {
        name: "vc-discordtabs",
        storage: storage,
        partialize: state => ({ _containers: state._containers }),
        onRehydrateStorage: () => state => state?.init()
    }
);
