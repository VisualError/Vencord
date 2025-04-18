/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { ErrorBoundary } from "@components/index";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByCodeLazy } from "@webpack";
import { ChannelStore, GuildChannelStore, Menu, React, SelectedChannelStore, SelectedGuildStore, useMemo, UserStore } from "@webpack/common";
import { Channel, Guild, Message } from "discord-types/general";
import { UserContextProps } from "plugins/biggerStreamPreview";

import TabContainer from "./components/TabContainer";
import { BasicChannelTabsProps } from "./interfaces";
import { ChannelTab, useTabsStore } from "./stores/finalStore";

export const logger = new Logger("DiscordTabs", "#b6d189");
const notificationsShouldNotify = findByCodeLazy(".SUPPRESS_NOTIFICATIONS))return!1");
const cl = classNameFactory("vc-discordtabs-");

export const DEFAULT_TAB_CONTAINER_ID = "defaultTabs";

const addUserTab: NavContextMenuPatchCallback = (children, { guildId, channelId }: { channelId: string; guildId: string; }) => {
    const { addNode: addTab, tabIds } = useTabsStore();
    const id = `${guildId ? `${guildId}/` : ""}${channelId ?? ""}`;
    const menuItem = (
        <Menu.MenuItem
            label="Add as Tab"
            id="add-as-tab"
            action={() => addTab(DEFAULT_TAB_CONTAINER_ID, id, {
                channelId: channelId ?? null,
                guildId: guildId ?? null,
                id: id,
                notifications: 1,
                title: "",
                icon: undefined
            })}
            disabled={id === "" || !!tabIds[id]}
        />
    );
    children.splice(1, 0, menuItem);
};


// this is so ass.
const addChannelsTab: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild; }) => {
    if (!guild) return;
    const { showHidden } = settings.use(["showHidden"]);
    const { addNode: addTab, removeNode: removeTab, containers } = useTabsStore();
    const channels: Channel[] = Object.values(GuildChannelStore.getChannels(guild.id, showHidden))
        .flatMap(arr => Array.isArray(arr) ? arr : [])
        .map(item => item.channel);

    // Group channels by their category;
    const groupedChannels = useMemo(() => Object.values(channels.reduce((reduced, channel) => {
        if (!channel.isCategory()) {
            const categoryId = channel.parent_id;
            if (!reduced[categoryId]) {
                reduced[categoryId] = {
                    category: ChannelStore.getChannel(categoryId),
                    children: []
                };
            }
            reduced[categoryId].children.push(channel);
        }
        return reduced;
    }, {} as Record<string, { category?: Channel; children: Channel[]; }>)), [channels]);

    children.splice(1, 0,
        <Menu.MenuItem label="Tab Channels" id="add-channels-as-tabs">
            {groupedChannels.map(({ category, children }) => (
                <Menu.MenuGroup
                    key={category?.id ?? "uncategorized"}
                    label={category?.name ?? "Uncategorized"}
                >
                    {children.map(channel => {
                        const id = `${channel.guild_id ? `${channel.guild_id}/` : ""}${channel.id ?? ""}`;
                        return (
                            <Menu.MenuItem
                                key={id}
                                id={id}
                                label={channel.name}
                            >
                                {Object.values(containers).map(group => <Menu.MenuCheckboxItem
                                    action={() => {
                                        if (!group.nodes[id]) {
                                            addTab(group.id, id, {
                                                channelId: channel.id,
                                                guildId: channel.guild_id,
                                                id: id,
                                                notifications: 1,
                                                title: "",
                                                icon: undefined
                                            });
                                        } else {
                                            removeTab(group.id, id);
                                        }
                                    }}
                                    key={group.id}
                                    id={group.id}
                                    label={group.name}
                                    checked={!!group.nodes[id]}
                                />).reverse()}
                            </Menu.MenuItem>
                        );
                    })}
                </Menu.MenuGroup>
            ))}
        </Menu.MenuItem>
    );
};

const userContextPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (user) return addUserTab(children, { channelId: ChannelStore.getDMFromUserId(user.id) });
};

const channelContextPatch: NavContextMenuPatchCallback = (children, { channel }: { channel: Channel; }) => {
    if (channel) return addUserTab(children, { channelId: channel.id, guildId: channel.guild_id });
};

export const settings = definePluginSettings({
    showHidden: {
        description: "Show all the stinky hidden channels on the tab selection menu",
        type: OptionType.BOOLEAN,
        default: false
    },
    autoCreateWhenMessage: {
        description: "Automatically creates a tab if you send a message.",
        type: OptionType.BOOLEAN,
        default: true
    },
    autoCreateWhenNotification: {
        description: "Automatically creates a tab if you get a notification",
        type: OptionType.BOOLEAN,
        default: true
    },
    botNotifications: {
        description: "Open bot mentions.",
        type: OptionType.BOOLEAN,
        default: false
    },
    createTabOnNewMessage: {
        description: "Create a new tab for ALL new messages, even if it isnt a notification.",
        type: OptionType.BOOLEAN,
        default: false,
    }
});

export function shouldCreateTab(message: Message, channel: string) {
    if (settings.store.createTabOnNewMessage) return true;
    const currentUser = UserStore.getCurrentUser();
    if (message.author.id === currentUser.id) return settings.store.autoCreateWhenMessage;
    if (!settings.store.autoCreateWhenNotification) return false;
    if (message.author.bot && !settings.store.botNotifications) return false;
    return notificationsShouldNotify(message, channel);
}

// function findFirstMatching<T>(set: Set<T>, fn: (id: T) => boolean): T | undefined {
//     for (const id of set) {
//         if (fn(id)) {
//             return id;
//         }
//     }
//     return undefined;
// }

// function findFirstAndMap<T, U>(set: Set<T>, fn: (id: T) => U): U | undefined {
//     for (const id of set) {
//         const ret = fn(id);
//         if (ret) {
//             return ret;
//         }
//     }
//     return undefined;
// }

// TODO: Set the isTabGroup prop in the containers.
// TODO: Set the isInTabGroup prop in tabs.

export default definePlugin({
    name: "DiscordTabsDEV",
    description: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    authors: [{ name: "FISH", id: 964921170501722122n }],
    dependencies: ["ContextMenuAPI"],
    // contextMenus: {
    //     "user-context": userContextPatch,
    //     "guild-context": addChannelsTab,
    //     "channel-context": channelContextPatch,
    //     "thread-context": channelContextPatch,
    //     "gdm-context": channelContextPatch,
    //     "channel-mention-context": channelContextPatch,
    //     "message": channelContextPatch,
    // },

    flux: {
        CONNECTION_OPEN: () => {
            console.log("Connection Open!");
            useTabsStore.getState().init();
        },
        MESSAGE_CREATE: ({ message, optimistic }: { message: Message & { guild_id: string; }; optimistic: boolean; }) => {
            if (optimistic) return;
            const tab_id = `${message.guild_id ? `${message.guild_id}/` : ""}${message.channel_id ?? ""}`;
            const { tabs, addTab } = useTabsStore.getState();
            if (tabs[tab_id] || !shouldCreateTab(message, message.channel_id)) return;
            addTab<ChannelTab>({
                id: tab_id,
                container_id: DEFAULT_TAB_CONTAINER_ID,
                channelId: message.channel_id ?? null,
                guildId: message.guild_id ?? null,
            });
        },
        // TODO: find a better flux that gets the friends tab, shop, ect.
        CHANNEL_SELECT: ({ channelId, guildId }: BasicChannelTabsProps) => {
            const { tabs, setSelection } = useTabsStore.getState();
            const tab_id = `${guildId ? `${guildId}/` : ""}${channelId ?? ""}`;
            const existing_tab = tabs[tab_id];
            const existing_group = tabs[existing_tab?.container_id];
            console.log(tab_id);

            if (existing_group) {
                setSelection("TabGroups", tab_id);
                setSelection("Tabs", existing_group.id);
                console.log("should open group");
            } else if (existing_tab) {
                setSelection("Tabs", tab_id);
                console.log("should open tab only");
            } else {
                console.log("Select go byebye");
                setSelection("Tabs", null!);
            }
        }
    },

    patches: [
        {
            find: ".COLLECTIBLES_SHOP_FULLSCREEN))",
            replacement: {
                match: /(\?void 0:(\i)\.channelId.*?"data-fullscreen":.*className:\i\.content[^}]*children:\[)(.*?)\]/,
                replace: "$1$self.renderGroups({currentChannel:$2}),$3]"
            }
        },
        // {
        //     find: ".COLLECTIBLES_SHOP_FULLSCREEN))",
        //     replacement: {
        //         match: /(\?void 0:(\i)\.channelId.*?"data-fullscreen":[^}]*children:\[)(.*?)\]/,
        //         replace: "$1$self.renderGroups({currentChannel:$2}),$3]"
        //     }
        // },

        // scuff attempt 1
        // {
        //     find: ".COLLECTIBLES_SHOP_FULLSCREEN))",
        //     replacement: {
        //         match: /(\?void 0:(\i)\.channelId.*?"data-fullscreen":.*className:\i\.content.*?children:)\((.*?}\))}\)\)/,
        //         replace: "$1[$self.renderGroups({currentChannel:$2}),($3]}))"
        //     }
        // }

        // attmept 2
        // {
        //     find: ".COLLECTIBLES_SHOP_FULLSCREEN))",
        //     replacement: {
        //         match: /(\?void 0:(\i)\.channelId.*?"data-fullscreen":.*className:\i\.content.*?Provider.*?children:)\((.*?)}\)}\)}\)/,
        //         replace: "$1[$self.renderGroups({currentChannel:$2}),($3})]})})"
        //     }
        // }

        // THIS IS SO CLOSE BUT IT DOESNT RENDER THE ENTIRE THING ANYMORE????????? WHYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
        // {
        //     find: ".COLLECTIBLES_SHOP_FULLSCREEN))",
        //     replacement: {
        //         match: /(\?void 0:(\i)\.channelId.*?"data-fullscreen":.*className:\i\.content.*?Provider.*?children:\[)(.*?\])/,
        //         replace: "$1$self.renderGroups({currentChannel:$2}),$3"
        //     }
        // }

        // {
        //     find: "Module was found in webpack cache so it has loaded",
        //     replacement: {
        //         match: /(\i.Suspense.*?children:)(.+?\)\))/,
        //         replace: "$1[$self.renderGroups({currentChannel:$2}),$2]"
        //     }
        // }

        // Crashes.
        // {
        //     find: ".COLLECTIBLES_SHOP_FULLSCREEN))",
        //     replacement: {
        //         match: /(\?void 0:(\i)\.channelId.*?"data-fullscreen":.*className:\i\.content.*?Provider.*?children:\[)(.*?)\]/,
        //         replace: "$1$self.renderGroups({currentChannel:$2, children:[$3]})]"
        //     }
        // }

        // {
        //     find: ".COLLECTIBLES_SHOP_FULLSCREEN))",
        //     replacement: {
        //         match: /(\?void 0:(\i)\.channelId.{0,300}return)((.{0,15})"div",{.*?\])(\}\)\}\})/,
        //         replace: "$1$4$self.renderOld,{currentChannel:$2,children:$3})$5"
        //     }
        // },
        // wtf is this
        // {
        //     find: "\"Maximize\";\"Minimize\"===",
        //     replacement: {
        //         match: /(null!=(\i).channelType.*?return)(.*?}\))}/,
        //         replace: "$1 $self.renderTest({guildId:$2.guildId,channelId:$2.channelId,children:$3})}"
        //     }
        // }

        // {
        //     find: "\"Maximize\";\"Minimize\"===",
        //     replacement: {
        //         match: /(null!=(\i).channelType.*?children:)(.*?\i}\)\))}/,
        //         replace: "$1[$self.renderTest({guildId:$2.guildId,channelId:$2.channelId}),$3]}"
        //     }
        // }

        // ITS EVERYWHER
        // {
        //     find: "secondaryColor:null!=",
        //     replacement: {
        //         match: /(return)(.*?\i}\))/,
        //         replace: "$1 $self.render({children:$2})"
        //     }
        // }

        // // PLS WORK. it do work but it sucks., rerenders everytab.
        // {
        //     find: "BaseHeaderBar.Divider",
        //     replacement: {
        //         match: /return(.{0,15}"section",.+?(,\i]}\)}\)))/,
        //         replace: "return $self.render({children:$1})"
        //     }
        // }

        // This works. No random rerenders. But only works on channel tabs
        // not working in vc tabs/message req/nitro/shop/friends
        // {
        //     find: "renderHeaderBar",
        //     replacement: {
        //         match: /(channel:(\i),channelName.*children:\i=>)(.*?.id\)\))/,
        //         replace: "$1{return[$self.renderGroups({currentChannel:$2}),$3]}"
        //     }
        // },
        // {
        //     find: "renderHeaderBar",
        //     replacement: {
        //         match: /(channel:(\i),channelName.*?children:\[)(.*?]})/,
        //         replace: "$1$self.renderGroups({currentChannel:$2}),$3"
        //     }
        // }
        // Id prefer it if this patch worked but since this is a class component, it means id have to rewrite
        // {
        //     find: "renderHeaderBar",
        //     replacement: {
        //         match: /("data-has-border":(\i)\..*?children:\[)(.*?)\]/,
        //         replace: "$1$self.renderGroups({currentChannel:$2}),$3]"
        //     }
        // }

        // {
        //     find: "renderHeaderBar",
        //     replacement: {
        //         match: /("data-has-border":(\i)\..*?children:)\[(.*?)\]/,
        //         replace: "$1_=>[$self.renderGroups({currentChannel:$2}),$3]"
        //     }
        // }
    ],
    settings: settings,

    // I havent tested if this messes up anything in performance than the other approaches. I cba rn.
    render({ children }) {
        const channelId = SelectedChannelStore.getChannelId();
        const guildId = SelectedGuildStore.getGuildId();
        const current_window_id = `${guildId ? `${guildId}/` : ""}${channelId ?? ""}`;
        logger.info("Rendering DEFAULT!", current_window_id);
        const getContainer = useTabsStore(state => state.getContainer);
        const selectedTabs = useTabsStore(state => state.selectedTabs);
        const selectedGroup = getContainer(selectedTabs.Tabs);
        return (
            <>
                <ErrorBoundary>
                    <div className={cl("container")} key="tab-container">
                        <TabContainer selector="Tabs" name="Tabs" data_id={DEFAULT_TAB_CONTAINER_ID} current_window_id={current_window_id} guildId={guildId} channelId={channelId} />
                        {
                            selectedGroup && selectedGroup.size > 0 &&
                            <TabContainer selector="TabGroups" name={selectedGroup.name} data_id={selectedGroup.id} current_window_id={current_window_id} guildId={guildId} channelId={channelId} />
                        }
                    </div>
                </ErrorBoundary>
                {children}
            </>
        );
    },
    renderTest({ guildId, channelId }: {
        guildId: string,
        channelId: string,
        children: any;
    }) {
        const current_window_id = `${guildId ? `${guildId}/` : ""}${channelId ?? ""}`;
        logger.info("Rendering DEFAULT!", current_window_id);
        const getContainer = useTabsStore(state => state.getContainer);
        const selectedTabs = useTabsStore(state => state.selectedTabs);
        const selectedGroup = getContainer(selectedTabs.Tabs);
        return (
            <ErrorBoundary>
                <div className={cl("container")}>
                    <TabContainer selector="Tabs" name="Tabs" data_id={DEFAULT_TAB_CONTAINER_ID} current_window_id={current_window_id} guildId={guildId} channelId={channelId} />
                    {
                        selectedGroup && selectedGroup.size > 0 &&
                        <TabContainer selector="TabGroups" name={selectedGroup.name} data_id={selectedGroup.id} current_window_id={current_window_id} guildId={guildId} channelId={channelId} />
                    }
                </div>
            </ErrorBoundary>
        );
    },
    renderGroups({ currentChannel }: {
        currentChannel: BasicChannelTabsProps,
    }) {
        const guildId = currentChannel?.guildId;
        const channelId = currentChannel?.channelId;
        logger.info("Rendering DEFAULT!", currentChannel);
        const current_window_id = `${guildId ? `${guildId}/` : ""}${channelId ?? ""}`;
        const getContainer = useTabsStore(state => state.getContainer);
        const selectedTabs = useTabsStore(state => state.selectedTabs);
        const selectedGroup = getContainer(selectedTabs.Tabs);
        return (
            <ErrorBoundary>
                <div className={cl("container")}>
                    <TabContainer selector="Tabs" name="Tabs" data_id={DEFAULT_TAB_CONTAINER_ID} current_window_id={current_window_id} channelId={channelId} guildId={guildId} />
                    {
                        selectedGroup && selectedGroup.size > 0 &&
                        <TabContainer selector="TabGroups" name={selectedGroup.name} data_id={selectedGroup.id} current_window_id={current_window_id} channelId={channelId} guildId={guildId} />
                    }
                </div>
            </ErrorBoundary>
        );
    },
    renderOld({ currentChannel, children }: {
        currentChannel: BasicChannelTabsProps,
        children: any;
    }) {
        const guildId = currentChannel?.guildId;
        const channelId = currentChannel?.channelId;
        logger.info("Rendering DEFAULT!", currentChannel);
        const current_window_id = `${guildId ? `${guildId}/` : ""}${channelId ?? ""}`;
        const getContainer = useTabsStore(state => state.getContainer);
        const selectedTabs = useTabsStore(state => state.selectedTabs);
        const selectedGroup = getContainer(selectedTabs.Tabs);
        return (
            <>
                <ErrorBoundary>
                    <div className={cl("container")}>
                        <TabContainer selector="Tabs" name="Tabs" data_id={DEFAULT_TAB_CONTAINER_ID} current_window_id={current_window_id} channelId={channelId} guildId={guildId} />
                        {
                            selectedGroup && selectedGroup.size > 0 &&
                            <TabContainer selector="TabGroups" name={selectedGroup.name} data_id={selectedGroup.id} current_window_id={current_window_id} channelId={channelId} guildId={guildId} />
                        }
                    </div>
                </ErrorBoundary>
                {children}
            </>
        );
    },
    // renderTabs({ currentChannel, children }: {
    //     currentChannel: BasicChannelTabsProps,
    //     children: JSX.Element;
    // }) {
    //     logger.info("Rendering top TABS!", currentChannel);
    //     return (
    //         <>
    //             <ErrorBoundary>
    //                 <div className={cl("container")}>
    //                     <TabContainer name="BEBEEBBEEBPEOPBEPOBPO" id="testing" currentChannel={currentChannel}></TabContainer>
    //                 </div>
    //             </ErrorBoundary>
    //             {children}
    //         </>);
    // },
});
