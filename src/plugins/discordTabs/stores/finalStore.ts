/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { proxyLazy } from "@utils/lazy";
import { Logger } from "@utils/Logger";
import { UserStore, zustandCreate, zustandPersist } from "@webpack/common";

import { logger } from "..";

type Tabs = Record<string, BaseTab>;
type Containers = Record<string, Container>;

export type ValidSelections = "TabGroups" | "Tabs";

interface BaseTab {
    id: string;
    container_id: string;
}

export interface ChannelTab extends BaseTab {
    channelId: string,
    guildId: string,
}

interface AddTabOptions {
    targetTabId: string,
    position: "before" | "after";
}

interface Node {
    dataId: string;
    prev?: string;
    next?: string;
}

interface Container {
    id: string;
    nodes: Record<string, Node>;
    head?: string;
    tail?: string;
    size: number,
    name: string;
}


interface Source {
    tabId: string,
    containerId: string;
}

interface UserTab extends BaseTab {
    channelId: string;
}

interface FriendsTab extends BaseTab {
    channelId: "@me";
}

interface TabGroup extends BaseTab {
    lastSelection: string;
}

interface TabsStore<T> {
    init(): void;

    selectedTabs: Record<ValidSelections, string>;
    tabs: Tabs;
    _persistentTabs: Record<string, Tabs>;
    addTab<U extends T>(data: U, options?: AddTabOptions): void;
    getTab<U extends T>(tabId: string): U;
    moveTab<U extends T>(source: Source, target: Source, position: "before" | "after", newData?: U): void;
    removeTab(containerId: string, tabId: string, alsoRemoveContainer?: boolean): void;
    getOrderedTabs<U extends T>(containerId: string): U[];

    setSelection(containerId: ValidSelections, tabId: string): void;
    clearSelection(containerId: ValidSelections): void;

    containers: Containers;
    _persistentContainers: Record<string, Containers>;
    getContainer(containerId: string): Container;
    addContainer(container: Container): void;
    removeContainer(containerId: string): void;
    getOrEnsureContainer(container: Container): Container;

    isTabGroup(tabId: string): boolean;
    isContainerATab(containerId: string): boolean;
    isTabInContainer(containerId: string, tabId: string): boolean;
}


type Zustand<T extends object> = {
    (): T,
    <K>(selector: (state: T) => K): K;
    getState(): T;
};
type StateSetter<T> = (newState: Partial<T> | ((prevState: T) => Partial<T>)) => void;
type StateGetter<T> = () => T;

// i cba to make the options type.
function createPersist<T extends object>(storeCreator: (set: StateSetter<T>, get: StateGetter<T>) => (Partial<T>), options: any) {
    return proxyLazy(() => zustandCreate(zustandPersist(storeCreator, options))) as Zustand<T>;
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

const log = new Logger("TabsStore");

// TODO: When a container is empty, remove the key from the containers record.
export const useTabsStore = createPersist<TabsStore<BaseTab>>(
    (set, get) => ({
        _persistentContainers: {},
        _persistentTabs: {},
        tabs: {},
        containers: {},
        selectedTabs: {} as Record<string, string>,
        init() {
            log.info("Loading.");
            const currentUserId = UserStore.getCurrentUser().id;
            const containers = get()._persistentContainers[currentUserId] ?? null;
            const tabs = get()._persistentTabs[currentUserId] ?? null;
            if (!containers || !tabs) return;
            const filteredContainers = Object.values(containers).reduce((newValue, current) => {
                if (current.size > 0) {
                    newValue[current.id] = current;
                }
                return newValue;
            }, {});
            log.info("Loaded!");
            set(state => ({ containers: filteredContainers, tabs: tabs, _persistentContainers: { ...state._persistentContainers, [currentUserId]: filteredContainers } }));
        },
        addTab(data, options) {
            const { container_id, id: tabId } = data;
            const existingTab = get().tabs[tabId];
            // TODO: Remove this from add tab, instead, just remove the tab manually. More flexibility this way.
            if (existingTab) {
                get().removeTab(existingTab.container_id, tabId, false);
            }
            set(state => {
                const container = state.containers[container_id];
                if (!container) throw "Container does not exist.";
                const newNode: Node = { dataId: tabId };
                let newHead = container.head;
                let newTail = container.tail;
                const newNodes = { ...container.nodes, [tabId]: newNode };

                if (options?.targetTabId && container.nodes[options.targetTabId]) {
                    const targetNode = container.nodes[options.targetTabId];

                    if (options.position === "before") {
                        newNode.next = options.targetTabId;
                        newNode.prev = targetNode.prev;
                        newNodes[options.targetTabId] = { ...targetNode, prev: tabId };
                        if (targetNode.prev) {
                            newNodes[targetNode.prev] = { ...container.nodes[targetNode.prev], next: tabId };
                        } else {
                            newHead = tabId;
                        }
                    } else if (options.position === "after") {
                        newNode.prev = options.targetTabId;
                        newNode.next = targetNode.next;
                        newNodes[options.targetTabId] = { ...targetNode, next: tabId };
                        if (targetNode.next) {
                            newNodes[targetNode.next] = { ...container.nodes[targetNode.next], prev: tabId };
                        } else {
                            newTail = tabId;
                        }
                    } else {
                        newNode.prev = container.tail;
                        if (container.tail) {
                            newNodes[container.tail] = { ...container.nodes[container.tail], next: tabId };
                        } else {
                            newHead = tabId;
                        }
                        newTail = tabId;
                    }
                } else {
                    newNode.prev = container.tail;
                    if (container.tail) {
                        newNodes[container.tail] = { ...container.nodes[container.tail], next: tabId };
                    } else {
                        newHead = tabId;
                    }
                    newTail = tabId;
                }

                const newContainer = { ...container, nodes: newNodes, head: newHead, tail: newTail, size: container.size + 1 };
                const newContainers = { ...state.containers, [container_id]: newContainer };

                const newTab = { ...data, container_id: container_id };
                const newTabs = { ...state.tabs, [tabId]: newTab };

                const currentUserId = UserStore.getCurrentUser().id;
                return {
                    _persistentContainers: { ...state._persistentContainers, [currentUserId]: newContainers },
                    _persistentTabs: { ...state._persistentTabs, [currentUserId]: newTabs },
                    containers: newContainers,
                    tabs: newTabs
                };
            });
        },
        removeTab(containerId, tabId, alsoRemoveContainer) {
            set(state => {
                const container = state.containers[containerId];
                if (!container) throw "Container does not exist.";
                const nodeRef = container.nodes[tabId];
                if (!nodeRef) throw "Tab ID does not exist in container.";
                const newNodes = { ...container.nodes };
                delete newNodes[tabId];
                if (nodeRef.prev) {
                    newNodes[nodeRef.prev] = { ...newNodes[nodeRef.prev], next: nodeRef.next };
                }
                if (nodeRef.next) {
                    newNodes[nodeRef.next] = { ...newNodes[nodeRef.next], prev: nodeRef.prev };
                }
                const newContainer = {
                    ...container,
                    nodes: newNodes,
                    size: container.size - 1,
                    head: container.head === tabId ? nodeRef.next : container.head,
                    tail: container.tail === tabId ? nodeRef.prev : container.tail,
                };
                const newContainers = { ...state.containers, [containerId]: newContainer };
                if (newContainer.size <= 0 && alsoRemoveContainer) {
                    logger.info("Removed container", containerId);
                    delete newContainers[containerId];
                }

                const currentUserId = UserStore.getCurrentUser().id;
                const newTabs = { ...state.tabs };
                delete newTabs[tabId];
                return {
                    _persistentContainers: { ...state._persistentContainers, [currentUserId]: newContainers },
                    _persistentTabs: { ...state._persistentTabs, [currentUserId]: newTabs },
                    tabs: newTabs,
                    containers: newContainers,
                };
            });
        },
        moveTab({ tabId: sourceId, containerId: sourceContainerId }, { tabId: targetId, containerId: targetContainerId }, position, newData) {
            const ref = get().tabs[sourceId];
            if (!ref) throw "Source tab does not exist.";
            if (sourceContainerId !== targetContainerId) {
                const sourceOnTarget = get().containers[targetContainerId].nodes[sourceId];
                if (sourceOnTarget) {
                    get().removeTab(targetContainerId, sourceId);
                }
            }
            const newTabData = newData ? { ...newData, container_id: targetContainerId, id: sourceId } : { ...ref, container_id: targetContainerId, id: sourceId };
            get().removeTab(sourceContainerId, sourceId);
            get().addTab(newTabData, { position: position, targetTabId: targetId });
        },
        getTab<U>(tabId) {
            return get().tabs[tabId] as U;
        },

        setSelection(selection, tabId) {
            set(state => ({ selectedTabs: { ...state.selectedTabs, [selection]: tabId } }));
        },
        clearSelection(selection) {
            set(state => {
                const newSelectedTabs = { ...state.selectedTabs };
                delete newSelectedTabs[selection];
                return { selectedTabs: newSelectedTabs };
            });
        },

        getContainer(containerId) {
            return get().containers[containerId];
        },
        getOrEnsureContainer(containerData) {
            const { id: containerId, name: newName } = containerData;
            const existingContainer = get().containers[containerId];
            if (!existingContainer) {
                set(state => ({ containers: { ...state.containers, [containerId]: { ...containerData } } }));
                return get().containers[containerId];
            } else if (newName !== existingContainer.name) {
                set(state => ({ containers: { ...state.containers, [containerId]: { ...existingContainer, name: newName } } }));
                return get().containers[containerId];
            }
            return existingContainer;
        },
        removeContainer(containerId) {
            const containerRef = get().containers[containerId];
            if (!containerRef) throw "Container does not exist";
            // Gotta remove all the tabs first before removing the container from the record.
            if (containerRef.size <= 0) {
                set(state => {
                    const currentUserId = UserStore.getCurrentUser().id;
                    const newContainers = { ...state.containers };
                    delete newContainers[containerId];
                    return { _persistentContainers: { ...state._persistentContainers, [currentUserId]: newContainers }, containers: newContainers };
                });
            } else
                Object.keys(containerRef.nodes).forEach(id => get().removeTab(containerId, id, true));
        },

        isTabGroup(tabId) {
            return !!get().containers[tabId];
        },

        isContainerATab(containerId) {
            return !!get().tabs[containerId];
        },
        isTabInContainer(containerId, tabId) {
            return !!get().containers[containerId].nodes[tabId];
        },

        getOrderedTabs<U>(containerId) {
            const container = get().containers[containerId];
            if (!container) throw "Container does not exist.";
            const { nodes, head } = container;
            const ordered: U[] = [];
            let current = nodes[head!];
            while (current) {
                const tabRef = get().tabs[current.dataId];
                if (!tabRef) throw `Tab ${current.dataId} does not exist in container ${containerId}`;
                ordered.push(tabRef as U);
                current = nodes[current.next!];
            }
            return ordered;
        },
    }),
    {
        name: "vc-discordtabs",
        storage: storage,
        partialize: state => ({ _persistentContainers: state._persistentContainers, _persistentTabs: state._persistentTabs }),
        onRehydrateStorage: () => state => state?.init()
    }
);
