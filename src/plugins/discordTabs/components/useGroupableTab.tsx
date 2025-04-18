/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByCodeLazy } from "@webpack";
import { lodash, useRef, useState } from "@webpack/common";

export const useDrag = findByCodeLazy("useDrag::spec.begin");
export const useDrop = findByCodeLazy(/\i=\(0,\i.\i\)\(\i.options\)/); // findByCodeLazy(".options);return", ".collect,");


type UseGroupableTabProps = {
    tabId: string;
    containerId: string;
    isInTabGroup: boolean;
    isTabGroup: boolean;
    onDrop: (targetId: string, targetContainerId: string, placement: "before" | "after") => void;
    store: {
        getOrEnsureContainer: (config: any) => any;
        moveTab: (source: any, target: any, position: any) => void;
        addTab: (config: any, options: any) => void;
        isTabInContainer: (containerId: string, tabId: string) => boolean;
    };
};

export default function useGroupableTab({
    tabId,
    containerId,
    isInTabGroup,
    isTabGroup,
    onDrop,
    store
}: UseGroupableTabProps) {
    const elemRef = useRef<HTMLDivElement>(null);
    const [dragPlacement, setPlacement] = useState<"before" | "after" | "group">();

    // Drag functionality
    const [{ isDragging }, drag] = useDrag(() => ({
        type: "vc_DiscordTab",
        item: { tabId, containerId, isInTabGroup, isTabGroup },
        collect: monitor => ({ isDragging: monitor.isDragging() })
    }), [tabId, containerId, isInTabGroup, isTabGroup]);

    // Drop functionality
    const [{ isHovering }, drop] = useDrop(() => ({
        accept: "vc_DiscordTab",
        collect: monitor => ({
            isHovering: monitor.isOver(),
        }),
        canDrop: item => {
            const areTabsDifferent = item.tabId !== tabId;
            const isTargetATabGroup = item.isTabGroup;
            return areTabsDifferent && (
                (isTargetATabGroup && store.isTabInContainer(containerId, item.tabId)) ||
                (!isTargetATabGroup)
            );
        },
        hover: lodash.throttle((item, monitor) => {
            if (!elemRef.current || !monitor.canDrop()) {
                setPlacement(undefined);
                return;
            }

            const rect = elemRef.current.getBoundingClientRect();
            const clientOffset = monitor.getClientOffset();
            if (!clientOffset) return;

            const hoverX = clientOffset.x - rect.left;
            const middleX = rect.width / 2;

            // Your existing placement calculation logic
            const groupZoneThreshold = 0.5;
            const groupZoneStart = rect.width * (0.5 - groupZoneThreshold / 2);
            const groupZoneEnd = rect.width * (0.5 + groupZoneThreshold / 2);
            const isInGroupZone = hoverX >= groupZoneStart && hoverX <= groupZoneEnd;
            const isNotTabGroup = !item.isTabGroup;

            const canGroup = // Case 1: Neither item nor dragged tab are in any group
                (!item.isInTabGroup && !isInTabGroup)
                ||
                // Case 2: Item is in a group, but dragged tab is not in that specific group
                (item.isInTabGroup && !store.isTabInContainer(item.containerId, tabId));

            let placement: typeof dragPlacement;
            if (isInGroupZone && isNotTabGroup && canGroup) {
                placement = "group";
            } else {
                placement = hoverX < middleX ? "before" : "after";
            }

            setPlacement(prev => prev !== placement ? placement : prev);
        }, 300),
        drop: item => {
            if (!dragPlacement) return;

            if (dragPlacement === "group") {
                if (isTabGroup) {
                    const groupContainer = store.getOrEnsureContainer({
                        id: tabId,
                        name: `Test ${tabId}`,
                        nodes: {},
                        size: 0,
                    });
                    const targetSource = { containerId: groupContainer.id, tabId: undefined! };
                    store.moveTab({ tabId: item.tabId, containerId: item.containerId }, targetSource, "after");
                    console.log("MOVE DA TAB TO GROUP");
                } else {
                    // todo: prob figure out a better way to make the id lol.
                    const groupContainer = store.getOrEnsureContainer({
                        id: `${tabId}${item.tabId}`,
                        name: "New Group",
                        nodes: {},
                        size: 0,
                    });
                    store.addTab({
                        id: groupContainer.id,
                        container_id: containerId,
                    }, {
                        position: "after",
                        targetTabId: tabId
                    });
                    const targetSource = { containerId: groupContainer.id, tabId: undefined! };
                    store.moveTab({ tabId, containerId }, targetSource, "after");
                    store.moveTab({ tabId: item.tabId, containerId: item.containerId }, targetSource, "after");
                }
            } else {
                onDrop(item.tabId, item.containerId, dragPlacement);
            }
        }
    }), [dragPlacement, tabId, containerId, isTabGroup, isInTabGroup]);

    // Combine DnD refs with horizontal scroll
    drag(drop(elemRef));

    return {
        ref: elemRef,
        isDragging,
        isHovering,
        dragPlacement
    };
}
