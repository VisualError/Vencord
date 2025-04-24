/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { findComponentByCodeLazy, LazyComponentWebpack } from "@webpack";
import { React, useEffect, useMemo, useRef } from "@webpack/common";

import { ChannelTab, useTabsStore, ValidSelections } from "../stores/finalStore";
import AddButton from "./AddButton";
import Tab from "./Tab";


const PlusSmallIcon = findComponentByCodeLazy("0v-5h5a1");
const cl = classNameFactory("vc-discordtabs-");

interface TabContainerProps {
    selector: ValidSelections;
    data_id: string;
    name: string,
    guildId: string,
    channelId: string,
    current_window_id: string,
}


export default function TabContainer({ data_id: containerId, name, current_window_id, selector, guildId, channelId }: TabContainerProps) {
    console.log("Rendering container", containerId);
    const getOrEnsureContainer = useTabsStore(state => state.getOrEnsureContainer);
    const getContainer = useTabsStore(state => state.getContainer);
    const removeContainer = useTabsStore(state => state.removeContainer);
    const { addTab, moveTab, removeTab, getOrderedTabs } = useTabsStore(state => ({
        addTab: state.addTab,
        moveTab: state.moveTab,
        removeTab: state.removeTab,
        getOrderedTabs: state.getOrderedTabs,
    }));
    const tabs = useTabsStore(state => state.tabs);
    const selectedTabs = useTabsStore(state => state.selectedTabs);
    const container = getOrEnsureContainer({ id: containerId, name: name, nodes: {}, size: 0 });
    const orderedTabs = useMemo(() => getOrderedTabs<ChannelTab>(containerId), [containerId, tabs]);

    // const [{ isHovering }, drop] = useDrop(() => ({
    //     accept: "vc_DiscordTab",
    //     collect: monitor => ({
    //         isHovering: monitor.isOver(),
    //     }),
    //     drop: item => {
    //         moveTab({ containerId: item.containerId, tabId: item.tabId }, { containerId: container.id, tabId: undefined! }, "after");
    //     }
    // }), [containerId]);

    // good enoggh..
    const ref = useRef<HTMLDivElement>(null);
    const scrollBy = useRef(0);
    useEffect(() => {
        const onWheel = e => {
            const container = ref.current;
            if (e.deltaY === 0) return;
            if (!container) return;
            e.preventDefault();
            const maxScrollLeft = container.scrollWidth - container.clientWidth;
            scrollBy.current += e.deltaY;
            scrollBy.current = Math.max(0, Math.min(scrollBy.current, maxScrollLeft));
            // const step = Math.abs(e.deltaY);
            // const direction = Math.sign(e.deltaY);
            // const current = container.scrollLeft;

            // const base = Math.round(current / step) * step;
            // const next = base + direction * step;
            container.scroll({
                left: scrollBy.current,
                behavior: "smooth"
            });
        };

        const scrollEnd = e => {
            if (!ref.current) return;
            scrollBy.current = ref.current.scrollLeft;
        };

        ref.current?.addEventListener("scrollEnd", scrollEnd);
        ref.current?.addEventListener("dragend", scrollEnd);
        ref.current?.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            ref.current?.removeEventListener("scrollEnd", scrollEnd);
            ref.current?.removeEventListener("dragend", scrollEnd);
            ref.current?.removeEventListener("wheel", onWheel);
        };
    }, []);
    return (
        <div ref={ref} className={cl("tab-container")}>
            {orderedTabs.map(tab => (
                <MemoizedTab
                    key={tab.id}
                    isTabGroup={!!getContainer(tab.id)}
                    isSelected={selectedTabs[selector] === tab.id}
                    isInTabGroup={selector === "TabGroups"}
                    id={tab.id}
                    containerId={container.id}
                    channelId={tab.channelId}
                    guildId={tab.guildId}
                    onDrop={(targetId, targetContainerId, position) =>
                        moveTab(
                            { tabId: targetId, containerId: targetContainerId },
                            { tabId: tab.id, containerId: container.id },
                            position)
                    }
                    onClose={() => {
                        if (!!getContainer(tab.id)) {
                            removeTab(container.id, tab.id);
                            removeContainer(tab.id);
                        } else {
                            removeTab(container.id, tab.id, selector === "TabGroups");
                        }

                    }}
                />
            ))}
            {<AddButton isVisible={current_window_id !== "" && !container.nodes[current_window_id]} onClick={() => {
                addTab<ChannelTab>({
                    channelId: channelId ?? null,
                    guildId: guildId ?? null,
                    id: current_window_id,
                    container_id: container.id
                });
            }} />}
            {/* { && <button
                ref={ref => drop(ref)}
                onClick={() => {
                    addTab<ChannelTab>({
                        channelId: channelId ?? null,
                        guildId: guildId ?? null,
                        id: current_window_id,
                        container_id: container.id
                    });
                }}
                data-placement={isHovering && "after"}
                className={cl("button", "new-button", "hoverable", "")}
            >
                < PlusSmallIcon />
            </button>} */}
        </div>);
    // const current_window_id = useMemo(() => `${currentChannel?.guildId ? `${currentChannel.guildId}/` : ""}${currentChannel?.channelId ?? ""}`, [currentChannel]);
    // const addTab = useTabsStore(state => state.addNode);
    // const removeTab = useTabsStore(state => state.removeNode);
    // const moveTab = useTabsStore(state => state.moveNode);
    // const getOrEnsureContainer = useTabsStore(state => state.getOrEnsureContainer);
    // const getOrderedNodes = useTabsStore(state => state.getOrderedNodes);
    // const isTabSelected = useTabsStore(state => state.isTabSelected);
    // const debouncedMove = useCallback(lodash.debounce(moveTab, 16, { leading: false, trailing: true }), []);
    // const container = getOrEnsureContainer(containerId, name, type, canGroup);

    // const handleClick = useCallback(() => {
    //     addTab(containerId, current_window_id, {
    //         channelId: currentChannel?.channelId ?? null,
    //         guildId: currentChannel?.guildId ?? null,
    //         id: current_window_id,
    //         notifications: 1,
    //         title: "",
    //         icon: undefined
    //     });
    // }, [current_window_id, containerId]);

    // const orderedTabs = getOrderedNodes(containerId);
    // console.log("Rerendering container", orderedTabs);

    // return (
    //     <div className={cl("tab-container")}>
    //         {orderedTabs.map(tab => (
    //             <MemoizedTab
    //                 isSelected={isTabSelected(tab.id)}
    //                 key={tab.id}
    //                 id={tab.id}
    //                 containerId={containerId}
    //                 channelId={tab.channelId}
    //                 guildId={tab.guildId}
    //                 onDrag={(targetId, targetContainerId, position) => debouncedMove(targetId, targetContainerId, tab.id, containerId, position)}
    //                 onClose={() => { removeTab(containerId, tab.id); }}
    //             />
    //         ))}
    //         {current_window_id !== "" && !container.nodes[current_window_id] && <button
    //             ref={ref => drop(ref)}
    //             onClick={handleClick}
    //             data-placement={isHovering && "after"}
    //             className={cl("button", "new-button", "hoverable", "")}
    //         >
    //             < PlusSmallIcon />
    //         </button>}
    //     </div>);
}

const MemoizedTab = LazyComponentWebpack(() => React.memo(Tab, (prev, next) => {
    return prev.id === next.id
        && prev.containerId === next.containerId
        && prev.isSelected === next.isSelected
        && prev.isTabGroup === next.isTabGroup
        && prev.isInTabGroup === next.isInTabGroup;

}));
