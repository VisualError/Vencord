/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { proxyLazy } from "@utils/lazy";
import { UserStore, zustandCreate, zustandPersist } from "@webpack/common";

import { BaseTab, LinkedNode } from "../interfaces";

interface LinkedList<T> {
    nodes: Record<string, LinkedNode<T>>;
    head?: string;
    tail?: string;
}

export type ContainerTypes = "General" | "TabGroup";

interface Container<T> extends LinkedList<T> {
    name: string,
    id: string,
    type: ContainerTypes;
    canGroup?: boolean,
}
type UserContainer<T> = Record<string, Container<T>>;

interface AddNodeOptions {
    targetTabId: string,
    position: "before" | "after";
}

interface LinkedListStore<T> {
    containers: UserContainer<T>;
    tabIds: Record<string, Set<string>>;
    selectedTabIds: Set<string>;
    _containers: Record<string, UserContainer<T>>;
    addSelectedTab: (tabId: string) => void;
    removeSelectedTab: (tabId: string) => void;
    addNode: (containerId: string, id: string, data: T, options?: AddNodeOptions) => void;
    removeNode: (containerId: string, id: string) => void;
    moveNode: (sourceId: string, sourceContainerId: string, targetId: string | undefined, targetContainerId: string, position: "before" | "after") => void;
    getOrEnsureContainer: (containerId: string, name: string, type: ContainerTypes, canGroup?: boolean) => Container<T>;
    getContainer: (containerId: string) => Container<T>;
    getOrderedNodes: (containerId: string) => T[];
    getNode: (containerId: string, tabId: string) => LinkedNode<T>;
    isTabSelected: (tabId: string) => boolean;
    init: () => void;
}


type zustandmomento<T extends object> = {
    (): T,
    <K>(selector: (state: T) => K): K;
    getState(): T;
};
type StateSetter<T> = (newState: Partial<T> | ((prevState: T) => Partial<T>)) => void;
type StateGetter<T> = () => T;

// i cba to make the options type.
function createPersist<T extends object>(storeCreator: (set: StateSetter<T>, get: StateGetter<T>) => (T), options: any) {
    return proxyLazy(() => zustandCreate(zustandPersist(storeCreator, options))) as zustandmomento<T>;
}

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

// TODO: Make tab selection more generic this is ass.
export const useTabsStore = createPersist<LinkedListStore<BaseTab>>(
    (set, get) => ({
        containers: {},
        tabIds: {},
        _containers: {},
        selectedTabIds: new Set(),
        isTabSelected(tabId) {
            return get().selectedTabIds.has(tabId);
        },
        addSelectedTab(tabId) {
            set(state => ({ selectedTabIds: new Set(state.selectedTabIds).add(tabId) }));
        },
        removeSelectedTab(tabId) {
            set(state => {
                const newSelectedTabIds = new Set(state.selectedTabIds);
                newSelectedTabIds.delete(tabId);
                return { selectedTabIds: newSelectedTabIds };
            });
        },
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
            set({ containers: containers, tabIds: tabIds });
        },
        // TODO: also do some checks here.
        getNode(containerId, tabId) {
            return get().containers[containerId].nodes[tabId];
        },
        getContainer(containerId) {
            return get().containers[containerId];
        },
        getOrEnsureContainer(containerId, name, type, canGroup?: boolean) {
            const container = get().containers[containerId];
            if (!container) {
                set(state => ({ containers: { ...state.containers, [containerId]: { id: containerId, nodes: {}, name, canGroup, type } } }));
                return get().containers[containerId];
            }
            if (container.name !== name) {
                set(state => ({ containers: { ...state.containers, [containerId]: { ...state.containers[containerId], name } } }));
                return get().containers[containerId];
            }
            return container;
        },
        // todo: rewrite this bs.
        addNode: (containerId, id, data, options) => {
            set(state => {
                const container = state.containers[containerId];
                if (!container) throw "Container does not exist.";
                if (container.nodes[id]) return state;

                const newNode: LinkedNode<any> = { id, data, prev: undefined };
                let newHead = container.head;
                let newTail = container.tail;
                const newNodes = { ...container.nodes, [id]: newNode };

                if (options?.targetTabId && container.nodes[options.targetTabId]) {
                    const targetNode = container.nodes[options.targetTabId];

                    if (options.position === "before") {
                        newNode.next = options.targetTabId;
                        newNode.prev = targetNode.prev;
                        newNodes[options.targetTabId] = { ...targetNode, prev: id };
                        if (targetNode.prev) {
                            newNodes[targetNode.prev] = { ...container.nodes[targetNode.prev], next: id };
                        } else {
                            newHead = id;
                        }
                    } else if (options.position === "after") {
                        newNode.prev = options.targetTabId;
                        newNode.next = targetNode.next;
                        newNodes[options.targetTabId] = { ...targetNode, next: id };
                        if (targetNode.next) {
                            newNodes[targetNode.next] = { ...container.nodes[targetNode.next], prev: id };
                        } else {
                            newTail = id;
                        }
                    } else {
                        newNode.prev = container.tail;
                        if (container.tail) {
                            newNodes[container.tail] = { ...container.nodes[container.tail], next: id };
                        } else {
                            newHead = id;
                        }
                        newTail = id;
                    }
                } else {
                    newNode.prev = container.tail;
                    if (container.tail) {
                        newNodes[container.tail] = { ...container.nodes[container.tail], next: id };
                    } else {
                        newHead = id;
                    }
                    newTail = id;
                }

                const newContainer = { ...container, nodes: newNodes, head: newHead, tail: newTail };
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
        // TODO: Do some checks here lmao.
        moveNode(sourceId, sourceContainerId, targetId, targetContainerId, position) {
            const ref = get().containers[sourceContainerId].nodes[sourceId].data;
            if (sourceContainerId !== targetContainerId) {
                const sourceOnTarget = get().containers[targetContainerId].nodes[sourceId];
                if (sourceOnTarget) {
                    get().removeNode(targetContainerId, sourceId);
                }
            }
            get().removeNode(sourceContainerId, sourceId);
            get().addNode(targetContainerId, sourceId, ref, { position: position, targetTabId: targetId! });
        },
        removeNode(containerId, id) {
            set(state => {
                const container = state.containers[containerId];
                if (!container) throw "Container does not exist.";
                const nodeRef = container.nodes[id];
                if (!nodeRef) throw "Tab does not exist.";
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
